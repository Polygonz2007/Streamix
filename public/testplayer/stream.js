
import Comms from "/comms.js";
import Frame from "./frame.js";

import Utils from "/util.js";

const Stream = new class {
    constructor() {
        this.load();

        // Params
        this.webworkers = false;
        
        // Streaming
        this.track_id = 329;
        this.format = 3; // Opus High
        this.time_offset = 0; // Seeking time offsets
        this.time_delay = 0; // Time offsets after small delays like loading
        this.group_id = 0;

        // Frames
        this.frames = [];
        this.frame_index = 0;
        this.flac_frame_size = 3840; // Get automatically
        this.opus_frame_size = 960;

        this.test2 = this.test2.bind(this);

    }

    /// PUBLIC INTERACTION FUNCTIONS ///

    


    /// PUBLIC UTILITY FUNCTIONS ///

    async load() {
        // If any step fails, success is false
        // TODO: Rewrite to not be like this
        let success = true;
        success = success && await Comms.ws_connect();
        success = success && await this.#load_audio_context();
        success = success && await this.#load_decoders();
        success = success && await this.#load_frame_sizes();

        return success;
    }

    get time() {
        return this.context.currentTime;
    }

    format_sample_size(format) {
        if (format <= 2)     return this.flac_frame_size; // FLAC (Max or CD)
        if (2 < format <= 6) return this.opus_frame_size; // OPUS (High, Mid, Low or Trash)

        return false;
    }

    frame_duration(format, sample_rate) {
        if (format <= 2)     return this.flac_frame_size / sample_rate; // FLAC (Max or CD)
        if (2 < format <= 6) return this.opus_frame_size / sample_rate; // OPUS (High, Mid, Low or Trash)

        return false;
    }


    /// PRIVATE FUNCTIONS ///

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

    async #load_frame_sizes() {
        return true;
    }

    #load_audio_context() {
        // iOS no audio on silent mode fix
        if (navigator.audioSession)
            navigator.audioSession.type = "playback";

        // Load audio context
        const AudioContext = window.AudioContext // Default
            || window.webkitAudioContext // Safari and old versions of Chrome
            || false; 

        if (AudioContext) {
            this.context = new AudioContext({ "latencyHint": "playback" });
            return true;
        } else { 
            alert("Sorry, this browser does not support AudioContext. Please upgrade to use Streamix!");
            return false;
        }
    }
}

export default Stream;

window.stream = Stream;