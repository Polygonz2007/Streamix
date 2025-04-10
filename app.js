
// Configurqation of the app
const config = {
    port: 80
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

const session_parser = session({
    secret: process.env.session_secret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // If using HTTPS, set to true
});

app.use(session_parser);

// HTTP
import http from "http";
const server = http.createServer(app);

// Coced-parses
import codec_parser from "codec-parser";
import fs from "fs";

// Decoder
import { FLACDecoder } from "@wasm-audio-decoders/flac";
const decoder = new FLACDecoder();


// WebSockets
import WebSocket, { WebSocketServer } from 'ws';
global.wss = new WebSocketServer({ noServer: true });

server.on('upgrade', function (request, socket, head) {
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
});

wss.on('connection', (ws, req) => {

    ws.on('message', async (data, isBinary) => {
        // Translate
        data = isBinary ? data : data.toString();
        data = JSON.parse(data);

        const client = req.session;

        console.log(data)

        // Functions
        const type = data.type;
        switch (type) {
            case "play":
                client.song = data.song;

                const file_path = `${music_path}/${client.song}.flac`;
                console.log('Loading "' + file_path + "'");

                const parser = new codec_parser("audio/flac");
                const file = fs.readFileSync(file_path);
                const frames = parser.parseAll(file);
                client.frames = frames;

                client.frame_index = 0;
                client.buffer_size = 16; // Move 16 frames per call (2s)

                client.frame_size = frames[0].samples;
                console.log(frames[0])

                return ws.send(prepare_json(2, {
                    "sampleRate": frames[0].header.sampleRate,
                    "totalLength": 44100,

                    "bufferLength": client.frame_size * client.buffer_size

                    // send various metadata and other stuff
                }));

            case "next_buf":
                const size = client.frame_size * client.buffer_size * 4; // 4 bytes per 32 bit sample
                let sample_data = [];

                let temp_frames = [];

                console.log("Frame indx " + client.frame_index)

                const frame_offset = client.frame_index * client.buffer_size;
                for (let i = 0; i < client.buffer_size; i++) {
                    const frame_number = frame_offset + i;
                    //console.log(`Fetching frame ${frame_number}`)

                    //if (frame_number > client.frames.length)
                    //    continue;

                    const frame = client.frames[frame_number];
                    temp_frames.push(frame);
                //    console.log(frame);
                //
                //    for (let channel = 0; channel < 2; channel++) {
                //        sample_data[channel] = decoder.decodeFrames(frame);//new Int32Array(size);
                //        //for (const sample of frame.channelData) { sample_data[channel].push(sample); }
                //    }
                }

                //for (let channel = 0; channel < 2; channel++) {
                if (temp_frames.length == 0)
                    ws.send("Done")

                const decoded = await decoder.decodeFrames(temp_frames);
                //}

                // Create buffer with message type and buffer index and audio data
                const metadata_length = 8;
                const channel_length = size * 2; // 4 bytes per sample, 2 channels
                const buffer = Buffer.alloc(metadata_length + channel_length);

                buffer.writeUInt32LE(1, 0);
                buffer.writeUInt32LE(client.frame_index, 4);

                Buffer.from(decoded.channelData[0].buffer).copy(buffer, 8);
                Buffer.from(decoded.channelData[1].buffer).copy(buffer, 8 + size);

                // Send
                client.frame_index++;
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
    const stringed = JSON.stringify(data);
    const buf = Buffer.alloc(4 + stringed.length);

    buf.writeUInt32LE(type);
    Buffer.from(stringed).copy(buf, 4);

    return buf;
}


// Start server
app.use(express.static(global.public_path));
server.listen(config.port, () => {
    console.log(`Server running on 127.0.0.1:${config.port}.`);
});