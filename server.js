
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
import * as stats from "./src/stats.js";
import * as database from "./src/database.js";
import { Indexer } from "./src/indexer.js";

database.open();

Indexer.scan(process.env.music_path);


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
import { serialize } from "v8";
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

    ws.on('message', async (data, isBinary) => {
        // Translate
        data = isBinary ? data : data.toString();
        data = JSON.parse(data);

        // Get important stuff
        const client = req.session;
        const req_id = data.req_id;

        // Validate
        const track_id = parseInt(data.track_id) || -1;
        //if (track_id <= 0)
        //    return;

        const block_index = parseInt(data.block_index);
        //if (block_index < 0)
        //    return;

        // Get format
        let format = data.format || 1;

        // Get data
        console.log(`Request for data Track #${track_id} Block #${block_index}`)
        const result = database.get_track_data(track_id, 0, block_index);

        // If we dont have any frames, the song is done
        if (!result) {
            format = 0; // Answer with format 0. Don't get or send any data
        }
            

        const num_frames = result.num_frames || 0;
        const block_size = result.block_size || 0;
        const block_data = result.block_data;

        // Create buffer with message type and buffer index and frame data
        const metadata_size = 4;
        const buffer = Buffer.alloc(metadata_size + block_size);

        // Write metadata - IIFN
        buffer.writeUInt16LE(req_id, 0);  // Request ID
        buffer.writeUInt8(format, 2);     // Format (1: MAX Flac)
        buffer.writeUInt8(num_frames, 3); // Number of frames (max 255)

        // Copy data into buffer (frame lengths and data)
        if (format != 0) {
            let offset = metadata_size;
            Buffer.from(block_data).copy(buffer, offset);
        }
        
        // Send to client
        stats.log_event("buffer_get");
        console.log("Sent.")
        return ws.send(buffer);
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
    stats.log_event("http_get");
    return next();
});

// Routes
app.get("/stats", (req, res) => {
    return res.send(stats.stats);
});



// Artists



// Albums

// Images
app.get("/album/:album_id/:filename", (req, res) => {
    const album_id = req.params.album_id;
    if (!album_id)
        return res.sendStatus(400);

    console.log("Fetching album cover for album #" + album_id + ".");
    console.log("FIlename: " + req.params.filename)

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

    if (size > 1024) // Too big
        size = 1024;

    console.log(size)

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
    const track_id = parseInt(req.params.track_id);
    if (!track_id)
        return res.sendStatus(400); // Give us an id idiot.

    // Get track info
    const metadata = database.get_track_meta(track_id);
    if (!metadata)
        return res.sendStatus(404); // Track does not exist

    // Return the info man
    return res.send({
        "sample_rate": metadata.sample_rate,
        "duration": metadata.duration,
        "num_blocks": metadata.num_blocks,
        "block_durations": metadata.block_durations,

        "track": {
            "name": metadata.track,
            "id": metadata.track_id,
            "number": metadata.track_number
        },

        "album": {
            "name": metadata.album,
            "id": metadata.album_id
        },

        "artist": {
            "name": metadata.artist,
            "id": metadata.artist_id
        }
    });
});


// Search
const search_index = database.get_all_track_meta();
app.post("/search", (req, res) => {
    // type: all, tracks, albums, artists (if none is present all is assumed)
    // string: what to search for
    // num_results: how many results to return
    // page: 0 by default, if incremented shows more results (may be less related)

    // Maybe replace with SQLite FTS5, but for now simple search
    // Foe now only tracks!

    const data = req.body;
    let string = data.string;
    if (!string)
        string = "";

    // Clean it
    string = string.toLowerCase();

    let results = [];
    for (let i = 0; i < search_index.length; i++) {
        if (results.length > 30)
            break;

        const c = search_index[i];

        if (c.track.toLowerCase().indexOf(string) != -1) {
            results.push({ "type": "track", "id": c.track_id });
            continue;
        }

        if (c.artist.toLowerCase().indexOf(string) != -1) {
            results.push({ "type": "track", "id": c.track_id });
            continue;
        }

        if (c.album.toLowerCase().indexOf(string) != -1) {
            results.push({ "type": "track", "id": c.track_id });
            continue;
        }
    }

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
    process.exit(0);
}