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
        this.ready = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        // PLAYBACK
        this.format = 1;
        this.track_id = 0;
        this.frame_index = 0;
        this.discontinuity = false;

        // FFmpeg
        this.ffmpeg;
        this.output;
        this.output_state = false;
    }

    async get_next_data() {
        console.log("GET NEXT DATA")
        //console.log(`Fetching frame data for track #${this.track_id} at frame id #${this.frame_index}`)

        // Transcode
        if (this.discontinuity)
            this.create_encoder(this.format); // Create new so we dont mess up users cache

        //let i = 0;
        //while (!this.output_state && i < 100) {
            // Get data and increment block index
            const result = database.get_track_frame(this.track_id, 0, this.frame_index);
            this.frame_index++;
            await this.transcode(result.frame_data);
            //i++;
        //}

        const final = this.output;
        console.log("YAHO WE GOT STUFF")
        return final;
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
        this.ffmpeg.stdin.write(data);
        this.ffmpeg.stdin.write(0);

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
            params = ["-f", "flac", "-rtbufsize", "1", "-ac", "2", "-i", input, "-frame_size", "4096", "-f", "flac", output]; // Nothing to be done (TEST: encode noise as 44100 hz flac)

        // FLAC MAX
        if (format == 2)
            params = ["-f", "flac", "-rtbufsize", "1", "-i", input, "-frame_size", "4096", "-ar", "44100", "-sample_format", "s16", "-f", "flac", output]; // Downsample to 44.1khz, 16 bit

        // OPUS
        if (format >= 3)
            params = ["-f", "flac", "-rtbufsize", "1", "-ac", "2", "-i", input, "-c:a", "libopus",  "-ar", "48000", "-b:a", "192k", "-application", "audio", "-frame_duration", "40", "-vbr", "on", "-cutoff", "0", "-f", "opus", output]; // Set bitrate, frame length, type, variable bitrate and fullband

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
            this.output_state = true;
            this.output = data;
            //this._resolve(data);
        });

        this.ffmpeg.stderr.on("data", (data) => {
            console.log(`Ffmpeg says ${data}`);
            //this._reject(data);
        });

        this.ffmpeg.on("close", (code) => {
            console.log(`FFmpeg closed with code ${code}.`);
        });

        // Attach pipes!
        const writestrean = createWriteStream("./something.opus");
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