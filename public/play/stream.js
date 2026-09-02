
import Comms from "/comms.js";
import Frame from "./frame.js";
import Buffer from "./buffer.js";

import Utils from "/util.js";

const Stream = new class {
    constructor() {
        this.load();

        // Params
        this.webworkers = false;
        this.buffer_time = 2; // x seconds of audio should be buffered
        
        // Streaming
        this.context;
        this._active = false; // When true, frames are activly loaded

        this.track_id = 0;
        this.level = 0;
        this.format = {};

        this.time_offset = 0; // Seeking time offsets
        this.time_delay = 0; // Time offsets after small delays like loading
        this.mad_time = 0;
        
        // Frames
        this.frames = new Buffer(196);
        this.frame_index = 0;
        this.group_id = 0;

        //this.test2 = this.test2.bind(this);

    }

    /// PUBLIC DYNAMIC VARIABLES ///
    get active() {
        return this._active;
    }

    set active(active) {
        this._active = active;

        if (this.active)
            this.check_buffer();
    }

    /// PUBLIC INTERACTION FUNCTIONS ///
    async set_state(track_id, level, frame_index, instant, buffer) {
        this.active = false;

        // Update the supplied values
        if (track_id !== null)
            this.track_id = track_id;

        if (level !== null)
            this.level = level;

        if (frame_index !== null)
            this.frame_index = frame_index;

        this.group_id++;
        await this.#load_format();

        // Do it in the way they say we should...

        this.active = true;
        return {
            track_id: this.track_id,
            group_id: this.group_id,
            level: this.level,
            frame_index: this.frame_index
        }
    }
    
    async stop() {
        console.log("STOPPPPPP")
        this.active = false;
        this.context.suspend();
    }

    async keep_group(group_id) {
        for (let i = 0; i < this.frames.size; i++) {
            const frame = this.frames.item[i];
            if (frame && frame.group_id != group_id)
                frame.stop();
        }
    }

    /// PUBLIC UTILITY FUNCTIONS ///

    async load() {
        // If any step fails, success is false
        // TODO: Rewrite to not be like this
        let success = true;
        success = success && await Comms.ws_connect();
        success = success && await this.#load_audio_context();
        success = success && await this.#load_decoders();

        return success;
    }

    get time() {
        return this.context.currentTime;
    }

    /// PRIVATE FUNCTIONS ///

    // Recursivly creates new frames until the buffer is healthy
    async check_buffer() {
        const newest_frame = this.frames.newest;

        let buffer_time = 0;
        if (newest_frame)
            buffer_time = newest_frame.time.start - this.time;

        if (this.active && buffer_time < this.buffer_time) {
            // Create frame
            const frame = new Frame(this.track_id, this.group_id, this.format, this.frame_index);
            
            // Load and prepare the frame
            this.frame_index++;
            const fetch_success = await frame.fetch();
            //console.log(newest_frame.done, !fetch_success)
            if (newest_frame.done && !fetch_success)
                this.stop();

            const prepare_success = await frame.prepare();

            //this.mad_time += frame.duration;
            
            frame.start((frame.index * frame.format.frame_size) / frame.format.samplerate + this.time_offset + this.time_delay);
            this.frames.add(frame);

            // Then try again to make sure buffer is healthy
            this.check_buffer();
        }

        return true;
    }

    async #load_decoders() {
        // Get
        const { FLACDecoder, FLACDecoderWebWorker } = window["flac-decoder"];
        const { OpusDecoder, OpusDecoderWebWorker } = window["opus-decoder"];

        // Create
        this.decoders = {};
        if (this.webworkers) {
            this.decoders.flac = new FLACDecoderWebWorker();
            this.decoders.opus = new OpusDecoderWebWorker();
        } else {
            this.decoders.flac = new FLACDecoder();
            this.decoders.opus = new OpusDecoder();
        }

        // Load
        await this.decoders.flac.ready;
        await this.decoders.opus.ready;

        console.log("Flac and Opus decoders loaded.");
        return true;
    }

    async #load_format() {
        // Fetch
        const data = await Comms.ws_req({
            action: "set_state",
            track_id: this.track_id,
            level: this.level,
            frame_index: this.frame_index
        });

        if (!data)
            return false;

        this.format = data.format;

        return true;
    }

    async #load_audio_context() {
        // iOS no audio on silent mode fix
        if (navigator.audioSession)
            navigator.audioSession.type = "playback";

        // Load audio context
        const AudioContext = window.AudioContext // Default
            || window.webkitAudioContext // Safari and old versions of Chrome
            || false; 

        if (AudioContext) {
            this.context = new AudioContext({ "latencyHint": "playback" });
            this.context.suspend();
            return true;
        } else { 
            alert("Sorry, this browser does not support AudioContext. Please upgrade to use Streamix!");
            return false;
        }
    }
}

export default Stream;

window.stream = Stream;
