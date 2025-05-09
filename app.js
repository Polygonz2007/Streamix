
// Configurqation of the app
const config = {
    http_port: 80,
    https_port: 443
}

// Get secrets
import dotenv from "dotenv";
dotenv.config();

const music_path = process.env.music_path;

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
import http from "http";
const http_server = http.createServer(app);

// Coced-parses
import codec_parser from "codec-parser";
import fs from "fs";

// Metadata parser
import { parseBuffer } from 'music-metadata';
import { uint8ArrayToBase64 } from 'uint8array-extras';

// Decoder
import { FLACDecoder } from "@wasm-audio-decoders/flac";
const decoder = new FLACDecoder();


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
                client.song = data.song;
                console.log(`\nRequest for song "${client.song}".`);

                const file_path = `${music_path}/${client.song}.flac`;
    
                // Check if it exists
                if (!fs.existsSync(file_path))
                    return ws.send(prepare_json(2));

                console.log(`File found for "${client.song}" at "${file_path}". Parsing.`);

                const parser = new codec_parser("audio/flac");
                const file = fs.readFileSync(file_path);
                const frames = parser.parseAll(file);
                client.frames = frames;

                const metadata = await parseBuffer(file);

                let image_str = "";
                if (metadata.common.picture) {
                    const picture = metadata.common.picture[0];
                    image_str = `data:${picture.format};base64,${uint8ArrayToBase64(picture.data)}`;
                }

                client.frame_index = -1; // So that it starts and works like it should immediatley (maybe fix layter)
                client.frame_count_per_buffer = 16; // Move 16 frames per call (1.5s)

                console.log(`"${file_path}" parsed.\n`);

                return ws.send(prepare_json(1, {
                    "sampleRate": frames[0].header.sampleRate,
                    "duration": metadata.format.duration,

                    "bufferLength": 4096 * client.frame_count_per_buffer,

                    "metadata": {
                        "title": metadata.common.title,
                        "artist": metadata.common.artist,
                        "album": metadata.common.album,
                        "cover": image_str
                    }

                    // send various metadata and other stuff
                }));

            case "next_buf":
                // Update this immediatley
                client.frame_index++;

                let data_size = 0; // Calculate total size of the data
                let data_frames = [];

                const frame_offset = client.frame_index * client.frame_count_per_buffer;
                for (let i = 0; i < client.frame_count_per_buffer; i++) {
                    const frame_number = frame_offset + i;
                    if (frame_number >= client.frames.length)
                        continue; // Song is done

                    const frame = client.frames[frame_number];
                    data_frames.push(frame.data);
                    data_size += frame.data.length;
                }

                // If we dont have any frames, the song is done
                if (data_frames.length == 0)
                    return ws.send(prepare_json(2)); // Signal that the song is done


                // Create buffer with message type and buffer index and frame data
                const metadata_size = 6 + data_frames.length * 2;
                const buffer = Buffer.alloc(metadata_size + data_size);

                buffer.writeUInt8(0, 0); // Type
                buffer.writeUInt8(0, 1); // Format
                buffer.writeUInt16LE(client.frame_index, 2); // Buffer index
                buffer.writeUInt16LE(data_frames.length, 4); // Number of frames

                // Write frame lengths
                for (let i = 0; i < data_frames.length; i++) {
                    const length = data_frames[i].length;
                    buffer.writeUint16LE(length, 6 + i * 2);
                }

                // Copy frame data into buffer
                let offset = metadata_size;
                for (let i = 0; i < data_frames.length; i++) {
                    Buffer.from(data_frames[i]).copy(buffer, offset);
                    offset += data_frames[i].length;
                }

                // Send to client
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


// Start server
app.use(express.static(global.public_path));
http_server.listen(config.http_port, () => {
    console.log(`HTTP server running on ${config.http_port}.`);
});

//https_server.listen(config.https_port, () => {
//    console.log(`HTTPS server running on port ${config.https_port}.`);
//});