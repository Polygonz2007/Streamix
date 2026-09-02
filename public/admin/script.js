
// SETTINGS
const update_rate = 0.5;

// IMPORTS
import Utils from "/util.js";
import Comms from "/comms.js";

// VARS
const body = document.querySelector("body");

const elements = {
    frame_bytes: document.querySelector("#frame_bytes"),
    ws_req: document.querySelector("#ws_req"),
    clients: document.querySelector("#clients"),
    cache: document.querySelector("#cache")
}

let width = 0;
let height = 400;
const canvas = document.querySelector("#frame_bytes_graph");
const ctx = canvas.getContext("2d");

// Smooth stats
let stats = {};
let prev_stats = {};
let prev_time = performance.now();

let display = true;


async function update_stats() {
    let data = await Comms.fetch_json("/data/stats");
    if (!data) return;

    // Calculate some stats
    data.frame_bytes_rate = ((stats.frame_bytes - prev_stats.frame_bytes) / update_rate) || 0;
    data.ws_req_rate = ((stats.ws_req - prev_stats.ws_req) / update_rate) || 0;

    // Udpate
    prev_stats = stats;
    prev_time = performance.now();
    stats = data;
}

function get_stats() {
    // Loop trough stats and lerp
    let temp = {};
    const keys = Object.keys(stats);
    const num_keys = keys.length;

    const distance = (performance.now() - prev_time) / (update_rate * 1000);
    for (let i = 0; i < num_keys; i++) {
        const key = keys[i];
        temp[key] = Math.round(Utils.lerp(prev_stats[key] || 0, stats[key] || 0, distance));
    }

    return temp;
}

function display_html() {
    if (!display)
        return;

    const data = get_stats();

    //body.innerHTML = `<h1>Stream Statistics</h1>
    //    <p>Server has started up ${data.startups} times...!</p>
    //    <p>A total of ${(data.frame_bytes / 1_000_000).toFixed(2)} MB has been transferred over ${data.ws_req} frames.</p>
    //    <p>HTTP requests: ${data.http_get}!!!</p>`;

    elements.frame_bytes.innerText = `${Utils.byte_size_string(data.frame_bytes, 2, true)} [${Utils.byte_size_string(data.frame_bytes_rate / 0.125)}ps]`;
    elements.ws_req.innerText = `${Utils.number_to_readable_string(data.ws_req)} [${data.ws_req_rate}/s]`;
    elements.clients.innerText = `${data.clients} [${Utils.byte_size_string(data.frame_bytes_rate / (0.125 * (data.clients || 1)), 0, false)}ps per client avg.]`;
    elements.cache.innerText = `${Utils.byte_size_string(data.cache, 1, true)}`;

    display_graph();
    //requestAnimationFrame(display_html);
}

let framebytesratesmooth = 0;
let prev_y = height;

function display_graph() {
    const data = get_stats();

    framebytesratesmooth = Utils.lerp(framebytesratesmooth, data.frame_bytes_rate, 0.05);

    // Draw line
    const y = (height - 1) - Math.round((Math.floor(framebytesratesmooth / (600_000 / height))));
    const diff = y - prev_y;
    ctx.fillStyle = "#F00";
    ctx.fillRect(width - 1, diff < 0 ? y : prev_y, 1, Math.abs(y - prev_y) + 1);
    prev_y = y;

    // Draw area
    ctx.fillStyle = "#F004";
    ctx.fillRect(width - 1, y, 1, height - y);
    
    // Shift to the left
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(ctx.canvas, -1, 0);
    // reset back to normal for subsequent operations.
    ctx.globalCompositeOperation = "source-over"
}

function start_graph() {
    width = window.innerWidth * devicePixelRatio;
    height = height * window.devicePixelRatio;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width / window.devicePixelRatio;
    canvas.style.height = height / window.devicePixelRatio;
}

// Start stats
await update_stats();
prev_stats = stats;
setInterval(update_stats, update_rate * 1000);

// start display
start_graph()
display_html();

// temp
setInterval(display_html, 25);