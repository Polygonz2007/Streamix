
import Comms from "./comms.js";

class Track {

}

const Queue = new class {
    constructor() {
        this.tracks = [];
        this._active_index = -1; // Index
    }

    add_track(track_data) {
        const idx = this.tracks.push({
            track_id: track_data.track.id,
            duration: track_data.duration,
            buffer_time: 0,
            sample_rate: track_data.sample_rate,

            block_index: -1,
            num_blocks: track_data.num_blocks,
            block_promises: [],

            track_data: track_data // lol :(
        });

        // Fill promises
        const track = this.tracks[idx - 1];
        for (let i = 0; i < track.num_blocks; i++) {
            const promise = new Promise((resolve, reject) => {
                track.block_promises[i] = {
                    resolve: resolve,
                    reject: reject
                };
            });

            track.block_promises[i].promise = promise;
        }

        //if ()
    }

    get active_index() {
        return this._active_index;
    }

    set active_index(val) {
        this._active_index = val;

        // Update UI
        UI.set_info(this.current.track_data);
        console.log("UPDATED THE UIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII")

        return true;
    }

    get time_offset() {
        // Track durations
        let offset = 0;
        for (let i = 0; i < this.active_index; i++) {
            offset += this.tracks[i].duration;
        }

        // Seeking offsets

        console.log(`Time offset: ${offset}`)
        return offset;
    }

    next() {
        // Next track
        if (this.active_index < 0 || this.current.block_index > this.current.num_blocks)
            this.active_index++;

        this.current.block_index++;

        return {
            track_id: this.current.track_id,
            block_index: this.current.block_index
        };
    }

    get current() {
        if (this.active_index < 0 || this.active_index > this.tracks.length)
            return false;
        
        return this.tracks[this.active_index];
    }

    get block_time() {
        const block_time = (this.current.block_index * 4096 * 64) / this.current.sample_rate;
        console.log(`Block time: ${block_time}`)
        return block_time;
    }
}

const UI = new class {
    constructor() {
        this.controls_div = document.querySelector("#controls");

        this.controls = {};
        this.controls.pause = document.querySelector("#pause");

        // Info
        this.info = {};
        this.info.title = document.querySelector("#title");
        this.info.artist = document.querySelector("#artist > .text");
        this.info.album = document.querySelector("#album > .text");

        this.info.cover = document.querySelector("#album-cover");
        this.info.background = document.querySelector("#background-image");
    }

    set_info(track_data) {
        if (!track_data)
            return; 

        // Set text
        this.info.title.innerText = track_data.track.name;
        this.info.artist.innerText = track_data.artist.name;
        this.info.album.innerText = track_data.album.name;

        // Find album cover size
        const img_size = parseInt((this.info.cover.getBoundingClientRect().width - 6) * window.devicePixelRatio);

        // Set album cover
        const cover_url = `/album/${track_data.album.id}/${img_size}.jpg`;
        this.info.cover.setAttribute("src", cover_url);
        this.info.background.setAttribute("src", cover_url);
    }
}

const Stream = new class {
    constructor() {
        // iOS no audio on silent mode fix
        if (navigator.audioSession)
            navigator.audioSession.type = "playback";

        // Load audio context
        const AudioContext = window.AudioContext // Default
            || window.webkitAudioContext // Safari and old versions of Chrome
            || false; 

        if (AudioContext) {
            this.context = new AudioContext({ "latencyHint": "playback" });
            console.log("Audiocontext loaded!");
        } else {
            alert("Sorry, this browser does not support AudioContext. Please upgrade to use Streamix!");
            UI.info.title.innerText = "No AudioContext detected!";
            return false;
        }

        // Settings
        this.formats = [
            "No data",
            "MAX [Flac]",
            "CD [Flac]",
            "High [Opus, 384 kbps]",
            "Medium [Opus, 192 kbps]",
            "Low [Opus, 96 kbps]"
        ]

        // Playback
        this.active = false; // If a song is loaded or not
        this.paused = true; // If playback is occuring
        
        this.volume = 1;
        this.buffer_time = 0;
        this.block_index = 0;

        this.track_id;

        // Global playback data
        this.desired_headroom = 4; // How many buffers to load in advance
        this._headroom = 0; // How many buffers are loaded after the current one

        this.sources = [];
    }

    async load_flac_decoder() {
        // Load FLAC decoder
        const { FLACDecoderWebWorker, FLACDecoder } = window["flac-decoder"];

        this.decoder = new FLACDecoder();
        await this.decoder.ready;

        console.log("Decoder ready!")
    }

    async play(track_id) {
        // Add to queue
        const track_data = await Comms.get_json(`/track/${track_id}`);
        Queue.add_track(track_data);
        
        if (this.headroom == 0)
            this.get_next_buffer();

        // Unpause
        this.paused = false;

        return true;
    }

    pause() {
        this.paused = !this.paused;
    }

    set paused(val) {
        this._paused = val;

        if (this.paused) {
            this.context.suspend();
            UI.controls_div.classList.add("paused");
        } else {
            this.context.resume();
            UI.controls_div.classList.remove("paused");
        }
    }

    get paused() {
        return this._paused;
    }

    set headroom(num) {
        this._headroom = num;
        console.log("checking headroom!")
        this.check_headroom();
    }

    get headroom() {
        return this._headroom;
    }

    check_headroom() {
        if (this.headroom < this.desired_headroom)
            this.get_next_buffer();
    }

    async get_next_buffer() {
        // Figure out what the next buffer is. (check track block quantity, and then queue)
        const { track_id, block_index } = Queue.next();

        const start = performance.now();
        
        // Request it (get from cache or server)
        const data = await Comms.get_buffer({
            track_id: track_id,
            block_index: block_index,
            format: 1 // Flac MAX delicuiussy
        });

        const transfer = performance.now();

        // Decode
        const decoded = await this.decode_data(data);
        if (decoded.error)
            return; // make sure it stops idk

        const decode = performance.now();

        // info
        document.querySelector("#debug-info").innerHTML += `<p id="bi${block_index}">
                                                                Block #${block_index}<br>
                                                                Transfer: ${Math.floor(transfer - start)}ms<br>
                                                                Decode: ${Math.floor(decode - transfer)}ms
                                                            </p>`;

        // Make sure previous one is in place
        if (block_index != 0)
            await Queue.current.block_promises[block_index - 1].promise;

        // Create source
        const source = await this.create_source(decoded.channelData, decoded.samplesDecoded, decoded.sampleRate);

        // Start
        const start_time = this.buffer_time;
        source.start(Queue.current.buffer_time + Queue.time_offset);
        Queue.current.buffer_time += source.buffer.duration;

        // Resolve
        console.log(Queue.current.block_promises);
        Queue.current.block_promises[block_index].resolve();

        this.headroom++;
        const index = this.sources.push(source);
        this.buffer_time += source.buffer.duration;

        // Started
        setTimeout(() => {
            document.querySelector(`#debug-info > #bi${block_index}`).setAttribute("class", "playing");
        }, (start_time - this.context.currentTime) * 1000)

        // Ended
        source.addEventListener("ended", () => {
            this.headroom--;
            document.querySelector(`#debug-info > #bi${block_index}`).setAttribute("class", "done");
            
            if (this.headroom == 0)
                this.paused = true;

            // Remove shit
            this.sources.splice(index);
            delete source.buffer;

            // Wairt a bit
            setTimeout(() => {
                const old = document.querySelector(`#debug-info > #bi${block_index}`);
                if (old)
                    old.remove();
            }, 18 * 1000);
            
        });
    }

    async decode_data(data) {
        const data_view = new DataView(data);

        const format = data_view.getUint8(2); // IIFN
        if (format == 0) // NO DATA
            return {error: "No data present in this buffer."};
        else 
            console.log(`Decoding buffer of type ${this.formats[format]}.`);

        // Split data into frames
        let frames = [];
        const frame_count = data_view.getUint8(3);
        console.log(frame_count)
        const metadata_size = 4 + frame_count * 2; // 6 bytes of metdata and then 2 * n bytes of lengths

        let offset = metadata_size;
        for (let i = 0; i < frame_count; i++) {
            // Get and push frame to array
            const length = data_view.getUint16(4 + i * 2, true);
            frames.push(new Uint8Array(data, offset, length));
            offset += length;
        }

        // Decode data
        if (!this.decoder.ready)
            return;

        const start = performance.now();
        const decoded = await this.decoder.decodeFrames(frames);
        const end = performance.now();

        console.log(`Decoding took ${end - start}ms.`)

        return decoded;
    }

    async create_source(data, num_samples, sample_rate) {
        const buffer = this.context.createBuffer(2, num_samples, sample_rate);

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

        return source;
    }

    flush() { // Stop all buffers
        console.log(this.sources)
        for (let i = 0; i < this.sources; i++) {
            const source = this.sources[i];
            source.stop(0);
            delete source.buffer;
        }

        this.sources = [];
    }
}

// Load decoders
await Stream.load_flac_decoder();

export default Stream;
window.stream = Stream;





// Attach events
document.querySelector("#pause").addEventListener("click", () => {
    Stream.pause();
})