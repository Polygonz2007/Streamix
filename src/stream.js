// Transcodes original file quality to whatever quality is requested by user.
// Does not transcode worse quality to a better quality as that it wasteful..


// Check what needs to be done
// Decode FLAC / whatever else
// Re-encode as other format
// Give back to streamig module


// Imports
import * as database from "./db/database.js";
import Stats from "./stats.js";

const Stream = class {
    constructor() {
        // Streaming
        this.track_id = 0;
        this.level = 0;
        this.format_id = null;

        // Caching
        this.cache = [];
        this.cache_size = 256;
        this.cache_start = -Infinity;
        this.cache_mem_size = 0;
    }

    // Call when track_id or level or frame_index changes
    async reload_cache(start_index) {
        const result = database.get_track_frames(this.track_id, this.format_id, start_index, this.cache_size);
        if (!result)
            return false;

        this.cache = result;
        this.cache_start = start_index;

        Stats.log("cache", -this.cache_mem_size);
        this.cache_mem_size = 0;
        for (let i = 0; i < this.cache.length; i++) {
            this.cache_mem_size += this.cache[i].frame_size;
        }
        Stats.log("cache", this.cache_mem_size);

        return true;
    }

    // Get next frame data for playback
    async get_frame(frame_index) {
        let index = frame_index - this.cache_start;
        if (!index || index < 0 || index >= this.cache_size) {
            const success = this.reload_cache(frame_index);
            if (!success)
                return false;
            
            index = frame_index - this.cache_start;
        }
        
        const frame = this.cache[index];
        if (!frame)
            return false;

        Stats.log("frame_bytes", frame.frame_size);
        return frame;
    }

    // Deallocate this
    close() {
        // Deallocate buffers
        delete this.cache;

        // Stats
        Stats.log("cache", -this.cache_mem_size);

        return;
    }
}

export default Stream;