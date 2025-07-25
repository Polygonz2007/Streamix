
import Comms from "./comms.js";

class Track {

}

const Stream = new class {
    constructor() {
        // Load audio context
        const AudioContext = window.AudioContext // Default
            || window.webkitAudioContext // Safari and old versions of Chrome
            || false; 

        if (AudioContext) {
            this.context = new AudioContext({ "latencyHint": "playback" });
            console.log("Audiocontext loaded!");
        } else {
            alert("Sorry, this browser does not support AudioContext. Please upgrade to use Streamix!");
            return false;
        }

        // Playback
        this.active = false; // If a song is loaded or not
        this.paused = true; // If playback is occuring
        
        this.volume = 1;

        // Global playback data
        this.desired_headroom = 4; // How many buffers to load in advance
        this.headroom = 0; // How many buffers are loaded after the current one
    }

    async get_next_buffer() {
        // Figure out what the next buffer is. (check track block quantity, and then queue)
        const track_id = 1;
        const block_id = 1;
        
        // Request it (get from cache or server)

        // Decode

        // Create source

        // Bind events

    }

    async decode_data(data) {

    }

    async create_source(data, duration, sample_rate) {
        const buffer = audioCtx.createBuffer(2, duration, sample_rate);

        // Fill the buffer with the data
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const nowBuffering = buffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                nowBuffering[i] = data[channel][i];
            }
        }

        // Get an AudioBufferSourceNode
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);

        return source;
    }
}

export default Stream;