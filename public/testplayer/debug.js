
// Helps with debugging

//import Stream from "./stream.js"
const Stream = new class {
    constructor() {
        return;
    }

    time() {
        return performance.now() * 0.001;
    }
}

const canvas = document.querySelector("canvas#frame-debug");
const ctx = canvas.getContext("2d");

const start_t = -1;
const end_t = 1;
const u = 60;

function viz_frames() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const frames = [{time_start: 2}, {time_start: 3}, {time_start: 3.5},{time_start: 3.7}] //Stream.frames; // shallow copy
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const rel_time = Stream.time() - frame.time_start;
        const pos = (-rel_time - start_t) / (end_t - start_t);
        if (pos < 0 || pos > 1)
            continue;

        ctx.fillStyle = "#0A0";
        if (pos < 0.5)
            ctx.fillStyle = "#A00";
        ctx.fillRect(pos * canvas.width, 0, 100, canvas.height);
    }

    // Playhead
    ctx.fillStyle = "#FFF";
    ctx.fillRect((0.5 * canvas.width) - 2, 0, 4, canvas.height);
}

function setup_canvas() {
    canvas.width = window.innerWidth;
    canvas.height = 48;
}

setup_canvas();
//setInterval(viz_frames, 1 / u);