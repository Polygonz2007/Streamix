
// Configurqation of the app
const config = {
    http_port: 80,
    https_port: 443
}

// Get secrets
import dotenv from "dotenv";
dotenv.config();

// Imports
import * as fs from "fs/promises";

import Utils from "./src/util.js";
import * as database from "./src/db/database.js";
import * as dbi from "./src/db/dbi.js";
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
        const client = req.session;
        Stats.log("ws_req");

        // Getting frames fast
        if (isBinary) {
            const data_view = new DataView(data.buffer);
            const req_id = data_view.getUint16(0);
            const frame_index = data_view.getUint16(2);

            const frame = await wsi.get_frame(client, req_id, frame_index);
            return ws.send(frame);
        }

        // Client wants to do an action. Parse JSON
        data = isBinary ? data : data.toString();
        data = JSON.parse(data);

        // Get important stuff
        const target = data.target;
        const action = data.action;

        let result;
        switch (action) {
            // Streaming
            case "set_state":       result = await wsi.set_state(client, data); break;
            //case 4: result = await wsi.seek_to(client, data); break;

            // Statistics
            //case 8: result = await wsi.log_played(client, data); break;
        }

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



// Items
app.get("/item/:item_id", async (req, res) => {
    // Get IDs
    const item_id = parseInt(req.params.item_id);
    if (!item_id)
        return res.sendStatus(400);

    // META
    let metadata = dbi.get_meta(item_id);
    if (!metadata)
        return res.sendStatus(404); // Track does not exist

    return res.send(metadata);
});

// Collections
app.get("/collection/:collection_id", async (req, res) => {
    // Get IDs
    const collection_id = parseInt(req.params.collection_id);
    if (!collection_id)
        return res.sendStatus(400);

    // Get data
    let data = database.get_collection_id(collection_id);
    if (!data)
        return res.sendStatus(404); // Track does not exist

    return res.send(data);
});

app.get("/collection/:collection_id/image", async (req, res) => {
    // Get IDs
    const collection_id = parseInt(req.params.collection_id);
    if (!collection_id)
        return res.sendStatus(400).send("Collection does not exist.");

    // Get image
    let { image } = database.get_collection_image(collection_id);
    if (!image)
        return res.sendFile(path.join(public_path, "asset/logo/512/Winter.png")); // No cover available

    // Downsize (constant for now)
    const size = 1024;

    Sharp(image)
    .resize({ width: size, kernel: "mks2021" })
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4', force: "true" }) // Keep good quality and colors, while optimizing for network
    .toBuffer()
    .then(scaled_img => {
        return res.contentType("image/jpeg").send(scaled_img);
    });
});

// Searching
app.post("/search", async (req, res) => {
    // Check
    let string = req.body.string;
    if (string == "")
        return res.status(400).send("Please provide a search query.");

    const page = req.body.page || 0;
    const page_size = req.body.page_size || 16;

    // Clean it
    string = string.toLowerCase();
    string = string.replace(/[^0-9a-z ]/gi, '');
    if (string.replace(/[^0-9a-z]/gi, '') == "")
        return res.status(400).send("Please provide a search query.");

    // Search
    const results = dbi.search(string, page, page_size);
    return res.send(results);
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
    //console.clear();
    console.log("\n// Streamix v0.1 //");
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

    Utils.clear_line();
    Utils.overwrite_line("Database is up to date.\n");
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
    console.log("\nSaving statistics and stopping server.\n");

    Stats.stats.clients = 0;
    Stats.stats.cache = 0;
    Stats.save();
    process.exit(0);
}