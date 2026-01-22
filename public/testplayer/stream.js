
// import frame (or just write it in here, i dont even know)

const Stream = new class {
    constructor() {
        // Settings
        this.format = 3; // Opus High
        this.webworkers = false;

        // Streaming
        this.track_id = undefined;

        this.frame_index = undefined;
        this.flac_frame_size = 960; // Get automatically
        this.opus_frame_size = 3840;

        this.frames = [];
    }

    /// PUBLIC INTERACTION FUNCTIONS ///




    /// PUBLIC UTILITY FUNCTIONS ///

    async load() {
        
    }

    format_sample_size(format) {
        if (format <= 2)     return this.flac_frame_size; // FLAC (Max or CD)
        if (2 < format <= 6) return this.opus_frame_size; // OPUS (High, Mid, Low or Trash)

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
        return;
    }
}

Stream.load();
export default Stream;
