
// Configurqation of the app
const config = {
    port: 80
}

// Get secrets
import dotenv from "dotenv";
dotenv.config();

const test_path = process.env.test_path;

// Path
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.public_path = path.join(__dirname, "public");

// Express
import express from "express";
const app = express();

// HTTP
import http from "http";
const server = http.createServer(app);

// Coced-parses
import codec_parser from "codec-parser";
import fs from "fs";

// Decoder
import { FLACDecoder } from "@wasm-audio-decoders/flac";

const parser = new codec_parser("audio/flac");
const file = fs.readFileSync(test_path);
const frames = parser.parseAll(file);

const frame = frames[0];
let frame_list = [];

for (let i = 0; i < 1000; i++) {
    frame_list.push(frames[i]);
}

console.log(frame)

app.get("/test", async (req, res) => {
    const decoder = new FLACDecoder();
    await decoder.ready;

    const data = await decoder.decodeFrames(frame_list);
    console.log(data)


    console.log(data);
    res.json(data);
})

// Start server
app.use(express.static(global.public_path));
server.listen(config.port, () => {
    console.log(`Server running on 127.0.0.1:${config.port}.`);
});