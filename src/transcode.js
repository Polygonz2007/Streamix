// Transcodes original file quality to whatever quality is requested by user.
// Does not transcode worse quality to a better quality as that it wasteful..


// Check what needs to be done
// Decode FLAC / whatever else
// Re-encode as other format
// Give back to streamig module


// Imports
import { FLACDecoder } from '@wasm-audio-decoders/flac';
import { OpusDecoder } from 'opus-decoder';

const Transcoder = new class {
    constructor() {
        this.ready = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    async load() {
        // Create decoders
        this.decoders = {};
        this.decoders.flac = new FLACDecoder();
        this.decoders.opus = new OpusDecoder();

        // Create encoders
        

        // Wait
        await this.decoders.flac.ready;
        await this.decoders.opus.ready;

        // Finished loading
        this._resolve();
    }
}