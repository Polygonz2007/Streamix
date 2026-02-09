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
        this.cache_index = 0;
        this.cache_mem_size = 0;

        // FFmpeg
        this.ffmpeg;
        this.output;
        this.output_state = false;
        this.tot_writ_bytes = 0;
    }

    async get_next_data() {
        //console.log(`\nFetching frame data\nTrack #${this.track_id}\nFrame ID #${this.frame_index}\nFormat ${this.format}`);

        // Transcode
        //if (this.discontinuity)
        //    this.create_encoder(this.format); // Create new so we dont mess up users cache

        // Update format
        if (this.frame_index % 4 == 0 && this.req_format != this.format) {
            this.format = this.req_format;
            this.cache = []; // We need new cache!
        }

        // Next buffer, fill up cache if empty
        this.cache_index++;

        if (this.cache_index >= this.cache_size || this.cache.length == 0) { //this.cache.length <= 0) {
            const start = performance.now();
            const index = (this.format <= 2) ? Math.floor(this.frame_index / this.flac_frame_mult) : this.frame_index;
            const result = database.get_track_frames(this.track_id, this.format, index, this.cache_size);
            if (!result)
                return false;

            this.cache = result;
            this.cache_index = 0;

            Stats.log("cache", -this.cache_mem_size);
            this.cache_mem_size = 0;
            for (let i = 0; i < this.cache.length; i++) {
                this.cache_mem_size += this.cache[i].frame_data.length;
            }
            Stats.log("cache", this.cache_mem_size);

            const end = performance.now();
            //console.log(`Cache updated in ${(end - start).toFixed(3)}ms`);
        }

        // Get next buffer and tellem taishi
        const buffer = this.cache[this.cache_index]; //.pop();
        if (!buffer)
            return false;

        // Increment
        if (this.format <= 2)
            this.frame_index += this.flac_frame_mult;
        else
            this.frame_index++;

        Stats.log("buffer_bytes", buffer.frame_data.length);
        return buffer;
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


        // Stats
        Stats.log("cache", -this.cache_mem_size);

        // Kill ffmpeg

        return;
    }
}

export default Stream;