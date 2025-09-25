
// Configurqation of the app
const config = {
    http_port: 80,
    https_port: 443
}

// Get secrets
import dotenv from "dotenv";
dotenv.config();

// Imports
import fs from "fs";
import Stats from "./src/stats.js";
import * as database from "./src/database.js";
import { Indexer } from "./src/indexer.js";
import Stream from "./src/stream.js";
import * as wsi from "./src/wsi.js";

// Let us do stats
await Stats.load();

// Open database
database.open();

// Find and scan directories
(async () => {
    const music_path = process.env.music_path;
    let music_dirs = music_path.slice(1, -2).split(";");
    for (let i = 0; i < music_dirs.length; i++) {
        music_dirs[i] = music_dirs[i].trim();
        await Indexer.scan(music_dirs[i]);
    }
})();


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

// Cocec-parser
import codec_parser from "codec-parser";

// Metadata parser
import { parseBuffer } from 'music-metadata';
import { uint8ArrayToBase64 } from 'uint8array-extras';

// Decoder
import { FLACDecoder } from "@wasm-audio-decoders/flac";
const decoder = new FLACDecoder();

// Image blob reduce
import Sharp from "sharp";

// WebSockets
import WebSocket, { WebSocketServer } from 'ws';
import { start } from "repl";
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

    // Create a stream thingy for them 🥰🥰🥰🥰🥰🥰🥰
    req.session.stream = new Stream();//🥰
    req.session.stream.load(); //heartwarming🥰

    ws.on('message', async (data, isBinary) => {
        const start_time = performance.now();

        // Translate
        data = isBinary ? data : data.toString();
        data = JSON.parse(data);

        // Get important stuff
        const client = req.session;
        const req_id = data.req_id;
        const type = data.type;

        // Switch case
        let result;
        switch (type) {
            case 0: result = await wsi.set_track(client, data); break;
            case 1: result = await wsi.next_buffer(client, data); break;
            case 4: result = await wsi.seek_to(client, data); break;
            case 8: result = await wsi.log_played(client, data); break;
        }

        const end_time = performance.now();
        console.log(`${(end_time - start_time).toFixed(2)}ms => Req #${req_id} from ... of type ${type}`);

        ws.send(result);
    });

    ws.on('close', () => {
        // Handle connection close
    });
});

// move to differtent plaves idiot
// Converts JSON into a Buffer with type, along with JSON data for client
function prepare_json(type, data) {
    if (!data)
        data = {};
    
    const stringed = JSON.stringify(data);
    const buf = Buffer.alloc(4 + stringed.length);

    buf.writeUInt32LE(type);
    Buffer.from(stringed).copy(buf, 4);

    return buf;
}



// Stats
app.get("*", (req, res, next) => {
    Stats.log("http_get");
    return next();
});

// Routes
app.get("/stats", (req, res) => {
    return res.send(`
        <h1>horrible stats page</h1>
        <p>Server has started up ${Stats.stats.startups} times...!</p>
        <p>A total of ${Math.round(Stats.stats.buffer_get / 1_000_00) / 10} MB has been transferred over ${Stats.stats.num_buffers} buffers.</p>
        <p>HTTP requests: ${Stats.stats.http_get}!!!</p>
    `);
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

    if (size > 2048) // Too big
        size = 2048;

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

    // Create correct thing
    if (req.params.track_id.endsWith(".format")) {
        // FORMAT
        const format_data = database.get_track_format(track_id);
        if (!format_data)
            return res.sendStatus(404); // Track does not exist

        return res.send(create_format_buffer(format_data));
    } else {
        // META
        const metadata = database.get_track_meta(track_id);
        if (!metadata)
            return res.sendStatus(404); // Track does not exist

        return res.send(create_metadata_json(metadata));
    } 
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

function create_format_buffer(metadata) {
    const num_blocks = metadata.num_blocks;
    const buffer_size = 4 + 4 + 2 + (4 * num_blocks);
    const buffer = new ArrayBuffer(buffer_size);
    const buffer_view = new DataView(buffer);
    console.log(`Buffer is ${buffer_size} bytes containing ${num_blocks} blocks.`);

    buffer_view.setUint32(0, metadata.sample_rate, true); // SAMPLE RATE
    buffer_view.setFloat32(4, metadata.duration, true); // DURATION
    buffer_view.setUint16(8, metadata.num_blocks, true); // NUM_BLOCKS

    let offset = 10;
    for (let i = 0; i < num_blocks; i++) {
        buffer_view.setFloat32(offset, metadata.block_durations[i], true); // BLOCK DURATIONS
        offset += 4;
    }

    return Buffer.from(buffer);
}


// Search
//let search_index;
//
//function update_search_index() {
//    const all_meta = database.get_all_track_meta();
//    search_index = [];
//
//    for (let i = 0; i < all_meta.length; i++) {
//        const meta = all_meta[i];
//        let keywords = "";
//
//        keywords += `${meta.track} ${meta.track_number} ${meta.album}`;
//        for (let i = 0; i < meta.artists.length; i++) {
//            keywords += ` ${meta.artists[i].artist}`;
//        }
//
//        search_index.push({
//            keywords: keywords,
//            meta: meta,
//            track_id: meta.track.id
//        });
//    }
//}

app.post("/search", (req, res) => {
    // type: all, tracks, albums, artists (if none is present all is assumed)
    // string: what to search for
    // num_results: how many results to return
    // page: 0 by default, if incremented shows more results (may be less related)

    // Maybe replace with SQLite FTS5, but for now simple search
    // Foe now only tracks!

    // Updates
    const start_time = performance.now();

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

    const end_time = performance.now();
    console.log(`Search for "${string}" took ${Math.ceil(end_time - start_time)}ms to complete.`);

    return res.send(results);

    // Response strcurure:
    // [
    //    { type: track, id: __ },
    //    { type: album, id: __ },
    //    ...
    // ]
});










// Start server
app.use(express.static(global.public_path));
http_server.listen(config.http_port, () => {
    console.log(`HTTP server running on ${config.http_port}.`);
    Stats.log("startups");
});

//https_server.listen(config.https_port, () => {
//    console.log(`HTTPS server running on port ${config.https_port}.`);
//});

// Close server
process.on('SIGTERM', shut_down);
process.on('SIGINT', shut_down);

function shut_down() {
    console.log("Stopping!");
    console.log("Saving stats...")

    // bro lagre json
    Stats.save();

    process.exit(0);
}