
// Helps with debugging

import Stream from "./stream.js"

const canvas = document.querySelector("canvas#frame-debug");
const ctx = canvas.getContext("2d");

const time1 = document.querySelector("#time1");
const time2 = document.querySelector("#time2");
const buffer = document.querySelector("#buffer");
const quality = document.querySelector("#quality");
const frame = document.querySelector("#frame");

let px_per_second = 600; // x pixels of distance = 1 second of audio
let start_t = -1;
let end_t = 1;

async function viz_frames() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "24px Nebula Sans";

    for (let i = 0; i < Stream.frames.size; i++) {
        const frame = Stream.frames.item[i];
        if (!frame)
            continue;

        const rel_time = (Stream.time - frame.time.start);
        const pos = (-rel_time - start_t) / (end_t - start_t);
        if (pos < -0.5 || pos > 1)
            continue;

        const size = frame.duration / (end_t - start_t);

        let frame_col = "#888";
        if (frame.ready) frame_col = "#AA0";
        if (frame.time.start < Stream.time && frame.time.end >= Stream.time) frame_col = "#0A0";
        if (frame.done) frame_col = "#00A";
        if (frame.error) frame_col = "#A00";
        
        // Frame
        ctx.fillStyle = frame_col;
        ctx.fillRect(pos * canvas.width, canvas.height / 2, (size * canvas.width) - window.devicePixelRatio, canvas.height / 2);

        // Group
        ctx.fillStyle = `hsl(${frame.group_id * 471}, 80%, 50%)`;
        ctx.fillRect(pos * canvas.width, canvas.height / 4 * 3, (size * canvas.width) + 4, canvas.height / 4);

        // Start marker, only for every 32 frames
        if (frame.index % 32 == 0) {
            ctx.fillStyle = "#FFFE";
            ctx.fillRect(pos * canvas.width, 0, 2, canvas.height);
            ctx.fillText(frame.index, pos * canvas.width + 8, 24, 128);
        }
    }

    // Playhead
    ctx.fillStyle = "#FFF8";
    ctx.fillRect((0.5 * canvas.width) - (1 * window.devicePixelRatio), 0, 2 * window.devicePixelRatio, canvas.height);


    // and then also draw more info
    const t = Stream.context.currentTime || 0;
    time1.innerHTML = `Clock: ${t.toFixed(2)}s`;
    time2.innerHTML = `Offset: ${Stream.time_offset.toFixed(2)}s + ${Stream.time_delay.toFixed(2)}s`;

    const newest_frame = Stream.frames.newest;
    if (newest_frame)
        buffer.innerHTML = `Buffer Health: ${(newest_frame.time.end - Stream.time).toFixed(1)}s`;
    else
        buffer.innerHTML = `Buffer Health: ?`;

    if (!Stream.format) {
        quality.innerHTML = "None";
    } else {
        if (Stream.format.lossless)
            quality.innerHTML = `${Stream.format.name}, lossless, ${Stream.format.samplerate} Hz @ ${Stream.format.bitdepth} bits per sample`;
        else
            quality.innerHTML = `${Stream.format.name}, lossy, ${Stream.format.samplerate} Hz @ ${Stream.format.bitrate} kbps`;
    }
    
    // Frame info
    if (newest_frame) {
        let index = newest_frame.index.toString();
        frame.innerHTML = `Buffering Frame Index: #${"0".repeat(5 - index.length) + index}`;
    } else {
        frame.innerHTML = `Buffering Frame Index: #?????`;
    }

    requestAnimationFrame(viz_frames);
}

function setup_canvas() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = 64 * window.devicePixelRatio;

    const scaled = canvas.width / px_per_second;
    start_t = scaled * -0.5;
    end_t = scaled * 0.5;
}

setup_canvas();
viz_frames();

window.addEventListener("resize", setup_canvas);
