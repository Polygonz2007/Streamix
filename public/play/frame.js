
import Comms from "/comms.js";
import Stream from "./stream.js";

const Frame = class {
    constructor(track_id, group_id, format, index) {
        this.track_id = track_id;
        this.group_id = group_id;
        this.format = format;
        this.index = index;

        this.data; // The data (raw)
        this.buffer; // The data (decoded samples)
        this.source; // The audio
        this.duration;

        this.ready = false;
        this.done = false;

        this.time = {};
        this.time.start = null;
        this.time.end = null;
    }

    /// PUBLIC FUNCTIONS ///

    // Fetch data for this frame.
    async fetch() {
        // Fetch
        const data = await Comms.get_frame(this.index);

        // Don't explode if no data
        if (!data) return false;
        this.data = data.data;

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

        delete this.data; // Don't waste space

        // temp
        if (this.buffer.channelData[0][0] == 0 && this.buffer.channelData[1][100] == 0)
            this.error = true;

        // Create source
        this.source = await this.#create_source();
        if (!this.source)
            return;

        // Add event for ending
        this.source.addEventListener("ended", () => {
            this.done = true;
            Stream.check_buffer();
        });

        this.duration = this.format.frame_size / this.format.samplerate;
        this.ready = true;

        return true;
    }
    
    // Sets the frame to start playing at this time (ovverrides any old time)
    start(time) {
        this.time.start = time;
        this.time.end = time + this.duration;
        this.source.start(this.time.start);
    }

    // If time is present, frame stops playing at that time (if it is already playing)
    // Otherwise, frame gets removed immediatley
    stop(time) {
        this.time.end = time;
        
        // Start at same time but end at the cancel time
        if (time) this.source.start(this.time.start, this.time.end);

        // Else, kill it immediatley
        this.source.stop(0);
        this.source.disconnect();
        this.done = true;
    }



    /// PRIVATE FUNCTIONS ///
    async #decode() {
        if (this.format.encoder == "flac") {
            // FLAC
            if (!Stream.decoders.flac.ready) return false;
            return await Stream.decoders.flac.decodeFrames([this.data]);
        }
        
        if (this.format.encoder == "libopus") {
            // OPUS
            if (!Stream.decoders.opus.ready) return false;
            return await Stream.decoders.opus.decodeFrames([this.data]);
        }

        return false;
    }

    async #create_source() {
        const samples = this.buffer.samplesDecoded;
        const buffer = Stream.context.createBuffer(2, samples, this.format.samplerate);

        // Fill the buffer with the data
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const buffering = buffer.getChannelData(channel);
            for (let i = 0; i < samples; i++) {
                buffering[i] = this.buffer.channelData[channel][i];
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
