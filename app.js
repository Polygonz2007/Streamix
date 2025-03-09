
// Configurqation of the app
const config = {
    port: 80
}

// Get secrets
import dotenv from "dotenv";
dotenv.config();


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

const parser = new codec_parser("audio/flac");
const frames = parser.parseAll(fs.readFileSync("E:/Media/Music/Detach.flac"));

const frame = frames[0];
console.log(frame)
app.get("/test", (req, res) => {
    res.send(fs.readFileSync("E:/Media/Music/Detach.flac"));
})

// Start server
app.use(express.static(global.public_path));
server.listen(config.port, () => {
    console.log(`Server running on 127.0.0.1:${config.port}.`);
});