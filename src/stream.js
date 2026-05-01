// Transcodes original file quality to whatever quality is requested by user.
// Does not transcode worse quality to a better quality as that it wasteful..


// Check what needs to be done
// Decode FLAC / whatever else
// Re-encode as other format
// Give back to streamig module


// Imports
import { spawn } from "child_process";
import { Readable, Writable } from "stream";

import * as database from "./db/database.js";
import Stats from "./stats.js";
import { appendFileSync, createWriteStream, readFileSync, writeFileSync } from "fs";

const Stream = class {
    constructor() {
        // Streaming
        this.track_id = 0;
        this.format_id = 1;
        this.frame_index = 0;

        // Caching
        this.cache = [];
        this.cache_size = 256;
        this.cache_index = 0;
        this.cache_mem_size = 0;
    }

    async reload_cache() {
        const start = performance.now();
        
        const result = database.get_track_frames(this.track_id, this.format_id, this.frame_index, this.cache_size);
        if (!result)
            return false;

        this.cache = result;

        Stats.log("cache", -this.cache_mem_size);
        this.cache_mem_size = 0;
        for (let i = 0; i < this.cache.length; i++) {
            this.cache_mem_size += this.cache[i].frame_size;
        }
        Stats.log("cache", this.cache_mem_size);

        const end = performance.now();
        console.log(`Cache updated in ${(end - start).toFixed(4)}ms`);
    }

    async next_cache_frame() {
        this.cache_index++;

        if (this.cache_index >= this.cache_size) {
            this.reload_cache();
            this.cache_index = 0;
        }

        if (this.cache.length == 0)
            return false; // No data to be had

        const frame = this.cache[this.cache_index];
        Stats.log("frame_bytes", frame.frame_size);
        return frame;
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