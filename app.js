
// Configurqation of the app
const config = {
    port: 80
}

// Get secrets
require('dotenv').config();


// Path
const path = require("path");
global.public_path = path.join(__dirname, "public");

// Express
const express = require("express");
const app = express();

// HTTP
const http = require("http");
const server = http.createServer(app);


// Start server
app.use(express.static(global.public_path));
server.listen(config.port, () => {
    console.log(`Server running on 127.0.0.1:${config.port}.`);
});