
import Stream from "./stream.js";

const Frame = class {
    constructor(track_id, group_id, format, sample_rate, index) {
        this.track_id = track_id;
        this.group_id = group_id;
        this.format = format;
        this.sample_rate = sample_rate;
        this.index = index;

        this.data;
        this.buffer;
    }

    /// PUBLIC FUNCTIONS ///

    // Fetch data for this frame.
    async fetch() {
        // Fetch
        const data = await Comms.ws_req({
            type: 0 // get buffer
        });

        // Don't explode if no data
        if (!data)
            return false;

        this.data = data;

        return true;
    }

    // Decode data and create an AudioBuffer that can be played
    async prepare() {
        // Don't explode if no data
        if (!this.data) return false;

        // Decode
        const decoded = await this.#decode();
        if (decoded.error) {
            console.log("deocde error")
            console.error(decoded.error)
            return; // make sure it stops idk
        }
    }

    schedule(time) {
        // Sets the frame to start playing at this time (ovverrides any old time)
    }

    cancel(time) {
        // If time is present, frame stops playing at that time (if it is already playing)
        // Otherwise, frame gets removed immediatley
    }



    /// PRIVATE FUNCTIONS ///
    async #decode() {
        const frame = new Uint8Array(this.data, 2);

        // Decode data
        if (this.format <= 2) {
            // FLAC
            if (!Stream.decoders.flac.ready) return false;
            return await Stream.decoders.flac.decodeFrames([frame]); // Does not have decodeFrame for some reason..
        } else if (this.format <= 6) {
            // OPUS
            if (!Stream.decoders.opus.ready) return false;
            return await Stream.decoders.opus.decodeFrames([frame]);
        } else {
            return false;
        }
    }

    async #create_buffer() {
        const samples = Stream.format 
        const buffer = Stream.context.createBuffer(2, samples, sample_rate);

        // Fill the buffer with the data
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const nowBuffering = buffer.getChannelData(channel);
            for (let i = 0; i < num_samples; i++) {
                nowBuffering[i] = data[channel][i];
            }
        }

        // Get an AudioBufferSourceNode
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        source.connect(this.analyser); // Vizaulizatn

        return source;
    }
}
