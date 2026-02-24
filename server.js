
// Configurqation of the app
const config = {
    http_port: 80,
    https_port: 443
}

// Get secrets
import dotenv from "dotenv";
dotenv.config();

// Imports
import * as database from "./src/database.js";
import Stats from "./src/stats.js";

import Indexer from "./src/indexer.js";
import Stream from "./src/stream.js";
import * as wsi from "./src/wsi.js";


// Path
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.public_path = path.join(__dirname, "public");

// Express
import express from "express";
import session from "express-session"
const app = express();

//const private_key  = fs.readFileSync('certs/selfsigned.key', 'utf8');
//const certificate = fs.readFileSync('certs/selfsigned.crt', 'utf8');
//
//var credentials = {key: private_key, cert: certificate};

const session_parser = session({
    secret: process.env.session_secret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true } // If using HTTPS, set to true
});

app.use(session_parser);
app.use(express.json());

// HTTP
import http, { Server } from "http";
const http_server = http.createServer(app);

// Image blob reduce
import Sharp from "sharp";

// WebSockets
import WebSocket, { WebSocketServer } from 'ws';
global.wss = new WebSocketServer({ noServer: true });

http_server.on('upgrade', upgrade_websocket);
//https_server.on('upgrade', upgrade_websocket);

function upgrade_websocket(request, socket, head) {
    socket.on('error', console.error);

    session_parser(request, {}, () => {
        if (false) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
    
        socket.removeListener('error', console.error);
    
        wss.handleUpgrade(request, socket, head, function (ws) {
            wss.emit('connection', ws, request);
        });
    });
}

wss.on('connection', (ws, req) => {

    // Create a stream thingy for them
    req.session.stream = new Stream();
    Stats.log("clients");
    //req.session.stream.create_encoder(1); // default quality (medium)    NO REAL TIME TRANSCODING FOR NOW

    req.session.ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;


    ws.on('message', async (data, isBinary) => {
        //const start_time = performance.now();

        // Translate
        data = isBinary ? data : data.toString();
        data = JSON.parse(data);

        // Get important stuff
        const client = req.session;
        const type = data.type;

        // Switch case
        let result;
        switch (type) {
            case 0: result = await wsi.next_buffer(client, data); break;

            case 1: result = await wsi.set_track(client, data); break;
            case 2: result = await wsi.set_format(client, data); break;

            case 4: result = await wsi.seek_to(client, data); break;
            case 8: result = await wsi.log_played(client, data); break;
        }

        //const end_time = performance.now();
        //console.log(`${(end_time - start_time).toFixed(2)}ms => Req #${data.req_id} from ${req.session.ip} of type ${type}`);

        Stats.log("ws_req");
        ws.send(result);
    });

    ws.on('close', () => {
        // Handle connection close
        req.session.stream.close();
        Stats.log("clients", -1);
    });
});


// Stats
app.get("*", (req, res, next) => {
    if (req.url !== "/data/stats")
        Stats.log("http_get");

    return next();
});

// Routes
app.get("/data/stats", (req, res) => {
    return res.send(Stats.get_json());
});


// App Icon
app.get("/favicon.ico", (req, res) => {
    return res.sendFile(path.join(public_path, "asset/logo/192/Winter Round.png"));
});


// Artists



// Albums

// Images
app.get("/album/:album_id/:filename", (req, res) => {
    const album_id = req.params.album_id;
    if (!album_id)
        return res.sendStatus(400);

    const img = database.get_album_image(album_id);
    if (!img) {
        // Reply with default image
        return res.sendFile(path.join(global.public_path, "asset/logo/512/Deep.png"));
    }
     
    // Make sure size is within reason
    if (!req.params.filename.endsWith(".jpg"))
        return res.sendStatus(400);

    if (req.params.filename == "max.jpg")
        return res.contentType("image/jpeg").send(img);

    let size = parseInt(req.params.filename);
    if (!size)
        return res.sendStatus(400);

    if (size < 32) // Too small
        size = 32;

    //return res.contentType("image/jpeg").send(img);

    // Scale image to desired size and send
    Sharp(img)
    .resize({ width: size, kernel: "mks2021" })
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4', force: "true" }) // keep good quality and colors, while optimizing for network
    .toBuffer()
    .then(scaled_img => {
        return res.contentType("image/jpeg").send(scaled_img);
    });
});



// Tracks
app.get("/track/:track_id", (req, res) => {
    // Get ID
    const track_id = parseInt(req.params.track_id);
    if (!track_id)
        return res.sendStatus(400); // Give us an id idiot.

    // META
    const metadata = database.get_track_meta(track_id);
    if (!metadata)
        return res.sendStatus(404); // Track does not exist

    return res.send(create_metadata_json(metadata));
});

function create_metadata_json(metadata) {
    let data = {
        "track": {
            "name": metadata.track,
            "id": metadata.track_id,
            "number": metadata.track_number
        },

        "album": {
            "name": metadata.album,
            "id": metadata.album_id,
            "cover": metadata.album_cover == 0 ? true : false
        },

        "artists": [],
        "album_artist": {
            "name": metadata.album_artist,
            "id": metadata.album_artist_id
        }
    };

    for (let i = 0; i < metadata.artists.length; i++) {
        data.artists.push({
            "name": metadata.artists[i].artist,
            "id": metadata.artists[i].artist_id
        });
    }

    return data;
}

// Searching
app.post("/search", (req, res) => {
    // type: all, tracks, albums, artists (if none is present all is assumed)
    // string: what to search for
    // num_results: how many results to return
    // page: 0 by default, if incremented shows more results (may be less related)

    // Maybe replace with SQLite FTS5, but for now simple search
    // Foe now only tracks!

    // Updates
    const data = req.body;
    let string = data.string;
    if (!string)
        string = "";

    // Clean it
    string = string.toLowerCase();
    string.replace("%", "");
    string.replace("_", "");

    //let results = [];
    //for (let i = 0; i < search_index.length; i++) {
    //    if (results.length > 30)
    //        break;
//
    //    const c = search_index[i];
//
    //    if (c.keywords.toLowerCase().indexOf(string) != -1) {
    //        results.push({ "type": "track", "id": c.track_id, "index": i });
    //        continue;
    //    }
    //}

    // compile for now
    const tracks = database.search(string, 32);
    if (!tracks)
        return res.send([]);

    let results = [];
    for (let i = 0; i < tracks.length; i++) {
        results.push(create_metadata_json(tracks[i]));
    }

    return res.send(results);

    // Response strcurure:
    // [
    //    { type: track, id: __ },
    //    { type: album, id: __ },
    //    ...
    // ]
});




// last fm
app.get("/lastfm/auth", (req, res) => {
    const token = req.params.token;
    if (!token)
        return res.send("Nahh");

    // THIS IS JUST FO TESTING
});



async function startup() {
    process.title = "Streamix";

    // Clear console
    process.stdout.write('\x1Bc');
    console.log("// Streamix v0.1 //");
    console.log(`HTTP server running. [:${config.http_port}]`);

    // Let us do stats
    await Stats.load();
    Stats.log("startups");

    // Open database
    database.open();

    // Set up indexer
    const music_path = process.env.music_path;
    let music_dirs = music_path.split(";");
    for (let i = 0; i < music_dirs.length; i++) {
        music_dirs[i] = music_dirs[i].trim();
        await Indexer.scan(music_dirs[i]);
    }

    console.log("Database is up to date.");
}

// Start server
app.use(express.static(global.public_path));
http_server.listen(config.http_port, startup);

//https_server.listen(config.https_port, () => {
//    console.log(`HTTPS server running on port ${config.https_port}.`);
//});

// Close server
process.on('SIGTERM', shut_down);
process.on('SIGINT', shut_down);

function shut_down() {
    console.log("\nSaving statistics and stopping server.");

    Stats.stats.clients = 0;
    Stats.stats.cache = 0;
    Stats.save();
    process.exit(0);
}