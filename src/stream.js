// Transcodes original file quality to whatever quality is requested by user.
// Does not transcode worse quality to a better quality as that it wasteful..


// Check what needs to be done
// Decode FLAC / whatever else
// Re-encode as other format
// Give back to streamig module


// Imports
import { spawn } from "child_process";
import { Readable, Writable } from "stream";

import * as database from "./database.js";
import Stats from "./stats.js";
import { appendFileSync, createWriteStream, readFileSync, writeFileSync } from "fs";

const Stream = class {
    constructor() {
        //this.ready = new Promise((resolve, reject) => {
        //    this._resolve = resolve;
        //    this._reject = reject;
        //});

        // PLAYBACK
        this.format = 1;
        this.req_format = 1;

        this.track_id = 0;
        this.frame_index = 0;
        this.flac_frame_mult = Math.floor(process.env.flac_frame_mult) || 4;

        this.discontinuity = false;

        // Caching
        this.cache = [];
        this.cache_size = 256;

        // FFmpeg
        this.ffmpeg;
        this.output;
        this.output_state = false;
        this.tot_writ_bytes = 0;
    }

    async get_next_data() {
        //console.log(`\nFetching frame data\nTrack #${this.track_id}\nFrame ID #${this.frame_index}\nFormat ${this.format}`);

        const start = performance.now();

        // Transcode
        //if (this.discontinuity)
        //    this.create_encoder(this.format); // Create new so we dont mess up users cache

        // Update format
        if (this.frame_index % 4 == 0 && this.req_format != this.format) {
            this.format = this.req_format;
            this.cache = []; // We need new cache!
        }

        // Fill up cache if empty
        if (this.cache.length <= 0) {
            const index = (this.format <= 2) ? Math.floor(this.frame_index / this.flac_frame_mult) : this.frame_index;
            const result = database.get_track_frames(this.track_id, this.format, index, this.cache_size);
            if (!result)
                return false;

            this.cache = result;
        }

        // Get next buffer and tellem taishi
        const buffer = this.cache.pop();

        // Increment
        if (this.format <= 2)
            this.frame_index += this.flac_frame_mult;
        else
            this.frame_index++;

        const end = performance.now();
        console.log(`Buffer prepared in ${(end - start).toFixed(4)}ms`);

        Stats.log("buffer_bytes", buffer.frame_data.length);
        return buffer;
    }

    async transcode(data) {
        console.log("TRANSCODE")
        console.log(`we ${this.output_state ? "SHOULD NOT" : "should"} be doing this!`);
        //const promise = new Promise((res, rej) => {
        //    this._resolve = res;
        //    this._reject = rej;
        //});

        // Generate shit
        //const buf = Buffer.alloc(4096 * 2 * 4);
        //for (let i = 0; i < 4096 * 2; i++) {
        //    buf.writeFloatLE(1 - Math.random() * 2, i * 4);
        //}

        // Pipe into ffmpeg
        this.tot_writ_bytes += data.byteLength;
        console.log("WRITTEN " + this.tot_writ_bytes + " FUCKING BYTES")
        this.ffmpeg.stdin.write(data);
        //this.ffmpeg.stdin.write(0);

        //return promise;
    }

    async create_encoder(format) {
        console.log("CREATE ENCODER")
        // Generate params
        let params;

        // Set quality params
        // 1: Flac max
        // 2: Flac CD
        // 3: Opus high
        // 4: Opus mid
        // 5: Opus low
        // 6: Opus trash

        const input = "pipe:0"; //"pipe:0";
        const output = "pipe:1";

        // FLAC MAX
        if (format == 1)
            params = ["-f", "flac", "-fflags", "+nobuffer", "-probesize", "32", "-max_probe_packets", "1", "-ac", "2", "-i", input, "-frame_size", "4096", "-flags", "+global_header", "-flush_packets", "1", "-f", "flac", output]; // Nothing to be done (TEST: encode noise as 44100 hz flac)

        // FLAC MAX
        if (format == 2)
            params = ["-f", "flac", "-rtbufsize", "10k", "-i", input, "-frame_size", "4096", "-ar", "44100", "-sample_format", "s16", "-flush_packets", "1", "-f", "flac", output]; // Downsample to 44.1khz, 16 bit

        // OPUS
        if (format >= 3)
            params = ["-f", "flac", "-max_probe_packets", "1", "-ac", "2", "-i", input, "-c:a", "libopus",  "-ar", "48000", "-b:a", "192k", "-application", "audio", "-frame_duration", "60", "-vbr", "on", "-cutoff", "0", "-flags", "+global_header", "-flush_packets", "1", "-f", "opus", output]; // Set bitrate, frame length, type, variable bitrate and fullband

        // OPUS BITRATES
        if (format == 3)
            params[13] = "384k"; // 384 kbps
        else if (format == 4)
            params[13] = "192k"; // 192 kbps (default)
        else if (format == 5)
            params[13] = "96k"; // 96 kbps
        else if (format == 6)
            params[13] = "8k"; // 8 kbps (maybe replace with like 32k when serious)

        // Be quiet!
        params.push("-loglevel", "error");

        // Pause transcoding and delete old FFmpeg.


        // Spawn new FFmpeg with these params and put in client.
        console.log(params)
        this.ffmpeg = spawn("ffmpeg", params);

        this.ffmpeg.stdout.on("data", (data) => {
            console.log("FFMPREG GAVE BIRTH TO SOME DATA 🥵🥵😱");
            console.log(data)
            this.output_state = true;
            this.output = data;
            this.tot_writ_bytes = 0;
            //this._resolve(data);
        });

        this.ffmpeg.stderr.on("data", (data) => {
            console.log(`Ffmpeg says ${data}`);
            //this._reject(data);
        });

        this.ffmpeg.on("close", (code) => {
            console.log(`FFmpeg closed with code ${code}.`);
        })
        // Attach pipes!
        const writestrean = createWriteStream("./something.flac");
        this.ffmpeg.stdout.pipe(writestrean);

        //this.output_stream = new Readable();
        //this.input_stream = new Writable();
        //
        //this.input_stream.pipe(this.ffmpeg.stdin);

        // Allow transcoding to keep going! (no longer block stuff)
    }

    set quality(val) {
        this._quality = val;
        this.create_encoder(val);
    }

    get quality() {
        return this._quality;
    }

    close() {
        // Deallocate buffers


        // Kill ffmpeg

    }
}

export default Stream;