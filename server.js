
// Configurqation of the app
const config = {
    http_port: 80,
    https_port: 443
}

// Get secrets
import dotenv from "dotenv";
dotenv.config();

// Imports
import fs, { glob } from "fs";
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
import ImageBlobReduce from "image-blob-reduce";
const reducer = new ImageBlobReduce();
console.log(reducer)

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

    ws.on('message', async (data, isBinary) => {
        // Translate
        data = isBinary ? data : data.toString();
        data = JSON.parse(data);

        const client = req.session;

        // Functions
        const type = data.type;
        switch (type) {
            case "play":
                client.track_id = data.track_id;
                console.log(`\nRequest for track #${client.track_id}`);

                const metadata = database.get_track_meta(client.track_id);
                client.block_index = -1; // So that it starts and works like it should immediatley (maybe fix layter)

                // Tell client about their precious song (replace with immediate first buffer)
                return ws.send(prepare_json(1, {
                    "sampleRate": metadata.sample_rate,
                    "duration": metadata.duration,

                    "bufferLength": 4096 * client.frame_count_per_buffer,

                    "track": {
                        "name": metadata.title,
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
                }));

            case "next_buf":
                // Update this immediatley
                client.block_index++;

                const result = database.get_track_data(client.track_id, 0, client.block_index);

                // If we dont have any frames, the song is done
                if (!result)
                    return ws.send(prepare_json(2)); // Signal that the song is done

                const num_frames = result.num_frames;
                const block_size = result.block_size;
                const block_data = result.block_data;

                // Create buffer with message type and buffer index and frame data
                const metadata_size = 6;
                const buffer = Buffer.alloc(metadata_size + block_size);

                buffer.writeUInt8(0, 0); // Type
                buffer.writeUInt8(0, 1); // Format
                buffer.writeUInt16LE(client.block_index, 2); // Buffer index
                buffer.writeUInt16LE(num_frames, 4); // Number of frames

                // Copy data into buffer (frame lengths and data)
                let offset = metadata_size;
                Buffer.from(block_data).copy(buffer, offset);

                // Send to client
                stats.log_event("buffer_request");
                return ws.send(buffer);
        }
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

// Albums
// Images
app.get("/album/:album_id/:filename", (req, res) => {
    const album_id = req.params.album_id;
    if (!album_id)
        return res.sendStatus(404);

    console.log("Fetching album cover for album #" + album_id + ".");

    const img = database.get_album_image(album_id);
    if (!img) {
        // Reply with default image
        return res.sendFile(path.join(global.public_path, "asset/logo/512/Deep.png"));
    }
     
    // Make sure size is within reason
    if (!req.params.filename.endsWith(".jpg"))
        return res.sendStatus(404);

    let size = parseInt(req.params.filename);
    if (!size)
        return res.sendStatus(404).send(`Please provide a size for the image, e.g. like this: "/album/17/512.jpg".`);

    if (size < 32) // Too small
        size = 32;

    if (size > 512) // Too big
        size = 512;

    console.log(size)

    // Scale image to desired size and send
    reducer.toBlob(img, { max: size }).then(blob => {
        return res.contentType("image/jpeg").send(blob);
    });
    console.log("does this run...")
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