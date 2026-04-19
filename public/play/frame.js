
import Comms from "/comms.js";
import Stream from "./stream.js";

const Frame = class {
    constructor(track_id, group_id, format, sample_rate, index) {
        this.track_id = track_id;
        this.group_id = group_id;
        this.format = format;
        this.sample_rate = sample_rate;
        this.index = index;

        this.data; // The data (raw)
        this.buffer; // The data (decoded samples)
        this.source; // The audio
        this.duration;

        this.ready = false;
        this.done = false;
        this.start_time;
        this.end_time;
    }

    /// PUBLIC FUNCTIONS ///

    // Fetch data for this frame.
    async fetch() {
        // Fetch
        const data = await Comms.ws_req({
            type: 0 // get buffer
        });

        // Don't explode if no data
        if (!data) return false;
        this.data = data;

        return true;
    }

    // Decode data and create an AudioBuffer that can be played
    async prepare() {
        // Don't explode if no data
        if (!this.data) return false;

        // Decode
        this.buffer = await this.#decode();
        if (this.buffer.error)
            return;

        // Create source
        this.source = await this.#create_source();
        if (!this.source)
            return;

        // Add event for ending
        this.source.addEventListener("ended", () => {
            this.done = true;
        });

        this.duration = this.buffer.samplesDecoded / this.sample_rate;
        this.ready = true;
        return true;
    }
    
    // Sets the frame to start playing at this time (ovverrides any old time)
    start(time) {
        this.start_time = time;
        this.source.start(this.start_time);
    }

    // If time is present, frame stops playing at that time (if it is already playing)
    // Otherwise, frame gets removed immediatley
    stop(time) {
        this.end_time = time;
        
        // Start at same time but end at the cancel time
        if (time) this.source.start(this.start_time, this.end_time);

        // Else, kill it immediatley
        this.source.stop();
        this.source.disconnect();
        this.done = true;
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

    async #create_source() {
        const samples = Stream.format_sample_size(this.format);
        const buffer = Stream.context.createBuffer(2, samples, this.sample_rate);

        // Fill the buffer with the data
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const nowBuffering = buffer.getChannelData(channel);
            for (let i = 0; i < this.buffer.samplesDecoded; i++) {
                nowBuffering[i] = this.buffer.channelData[channel][i];
            }
        }

        // Get an AudioBufferSourceNode
        const source = Stream.context.createBufferSource();
        source.buffer = buffer;
        source.connect(Stream.context.destination);

        return source;
    }
}

export default Frame;
