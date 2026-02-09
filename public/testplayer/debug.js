
// Helps with debugging

import Stream from "./stream.js"

const canvas = document.querySelector("canvas#frame-debug");
const ctx = canvas.getContext("2d");

const time1 = document.querySelector("#time1");
const time2 = document.querySelector("#time2");
const quality = document.querySelector("#quality");

const start_t = -2;
const end_t = 2;
const u = 144;

function viz_frames() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "32px Nebula Sans";

    let frames = Stream.frames;
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const rel_time = (Stream.time - frame.start_time);
        const pos = (-rel_time - start_t) / (end_t - start_t);
        if (pos < -0.5 || pos > 1)
            continue;

        const size = frame.duration / (end_t - start_t);

        let frame_col = "#888";
        if (frame.data) frame_col = "#AA0";
        if (frame.ready) frame_col = "#0A0";
        if (frame.done) frame_col = "#00A";
        
        // Start marker, and frame itself
        ctx.fillStyle = "#000";
        ctx.fillRect(pos * canvas.width - 2, 0, 2, canvas.height);
        ctx.fillStyle = frame_col;
        ctx.fillRect(pos * canvas.width, 0, size * canvas.width, canvas.height);

        // And last part of frame index
        ctx.fillStyle = "#FFF";
        ctx.fillText(String(frame.index + 100).slice(-2), pos * canvas.width + 4, canvas.height - 12, 50);
    }

    // Playhead
    ctx.fillStyle = "#FFF";
    ctx.fillRect((0.5 * canvas.width) - 2, 0, 4, canvas.height);


    // and then also draw more info
    const t = Stream.context.currentTime || 0;
    time1.innerHTML = `Clock: ${t.toFixed(2)}s`;
    time2.innerHTML = `Offset: ${Stream.time_offset.toFixed(2)}s + ${Stream.time_delay.toFixed(2)}s`;
}

function setup_canvas() {
    canvas.width = window.innerWidth;
    canvas.height = 48;
}

setup_canvas();
setInterval(viz_frames, 1 / u);
