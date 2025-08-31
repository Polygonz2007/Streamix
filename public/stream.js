
import Comms from "/comms.js";
import UI    from "/ui.js";

class Track {
    constructor(id) {
        this.ready = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        this.loaded = false;
        this.id = id;

        this.block_index = -1;
        this.start_time = 0;
    }

    async load() {
        // Prevent double loading
        if (this.loaded)
            return false;

        // Fetch data
        const track_meta = await Comms.fetch_json(`/track/${this.id}`);
        const track_format_buffer = await Comms.fetch_buffer(`/track/${this.id}.format`);

        // Decode format
        const track_format = this.decode_format(track_format_buffer);

        // Store info
        this.sample_rate = track_format.sample_rate;
        this.duration = track_format.duration;
        this.num_blocks = track_format.num_blocks;
        this.block_durations = track_format.block_durations;

        this.title = track_meta.track.name;
        this.album = track_meta.album;
        this.artists = track_meta.artists;
        this.album_artist = track_meta.album_artist;

        this._resolve();
        this.loaded = true;
    }

    decode_format(track_format_buffer) {
        let result = {};
        const buffer_view = new DataView(track_format_buffer);

        // Get info
        result.sample_rate = buffer_view.getUint32(0, true); // SAMPLE RATE
        result.duration = buffer_view.getFloat32(4, true); // DURATION
        result.num_blocks = buffer_view.getUint16(8, true); // NUM_BLOCKS
        result.block_durations = [];

        // Get all block durations
        let offset = 10;
        for (let i = 0; i < result.num_blocks; i++) {
            result.block_durations.push(buffer_view.getFloat32(offset, true)); // BLOCK DURATIONS
            offset += 4;
        }

        return result;
    }

    get_block_time(block_index) {
        if (block_index < 0 || block_index > this.num_blocks)
            return 0;

        let time = 0;
        for (let i = 0; i < block_index; i++) {
            time += this.block_durations[i];
        }

        return time;
    }
}

export const Queue = new class {
    constructor() {
        this.tracks = [];
        this._active_index = -1; // Index
        this.playing_index = -1;
    }

    async add_track(track_id) {
        // Create track and add it
        const track = new Track(track_id);
        await track.load();

        const index = this.tracks.push(track) - 1;

        // Start playback if not already going
        if (!Stream.active) {
            this.active_index = index;
        }
    }

    get_track(track_index) {
        return this.tracks[track_index];
    }

    get active_index() {
        return this._active_index;
    }

    set active_index(val) {
        this._active_index = val;

        return true;
    }

    get time_offset() {
        // Track durations
        let offset = 0;
        for (let i = 0; i < this.active_index; i++) {
            offset += this.tracks[i].duration;
        }

        // Seeking offsets

        return offset;
    }

    next() {
        // Is there anything to play lol
        if (!this.current)
            return false;

        // Next track
        if (this.active_index < 0 || this.current.block_index > this.current.num_blocks)
            this.active_index++;

        const current_track = this.current;
        if (!current_track)
            return false;

        current_track.block_index++;

        return {
            track_id: current_track.id,
            block_index: current_track.block_index,
            track_index: this.active_index
        };
    }

    get current() {
        if (this.active_index < 0 || this.active_index > this.tracks.length)
            return false;
        
        return this.tracks[this.active_index];
    }

    get playing() {
        if (this.playing_index < 0 || this.playing_index > this.tracks.length)
            return false;
        
        return this.tracks[this.playing_index];
    }
}


export const Stream = new class {
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
            console.log("AudioContext loaded!");
        } else {
            alert("Sorry, this browser does not support AudioContext. Please upgrade to use Streamix!");
            UI.info.title.innerText = "No AudioContext detected!";
            return false;
        }

        // Settings
        this.format = 1;
        this.formats = [
            "No data",
            "Max [Flac]",
            "CD [Flac]",
            "High [Opus, 384 kbps]",
            "Medium [Opus, 192 kbps]",
            "Low [Opus, 96 kbps]"
        ]

        // Debug
        this.debug = true;

        // Playback
        this.active = false; // If false, no song is up next and therefore nothing can play
        this.paused = true; // If playback is occuring
        this.buffering = false; // Wait until headroom is topped before playback.
        
        this.volume = 1;
        this.buffer_time = 0;
        this.block_index = 0;

        this.track_id;

        // Global playback data
        this.desired_headroom = 96; // How many buffers to load in advance
        this._headroom = 0; // How many buffers are loaded after the current one

        this.sources = [];
        this.events = [];
    }

    async load_decoders() {
        // get
        const { FLACDecoderWebWorker, FLACDecoder } = window["flac-decoder"];
        const { OpusDecoder } = window["opus-decoder"];

        // create
        this.decoders = {};
        this.decoders.flac = new FLACDecoder();
        this.decoders.opus = new OggOpusDecoder();

        // load
        await this.decoders.flac.ready;
        await this.decoders.opus.ready;

        // Good!
        console.log("Flac and Opus decoders loaded!");
    }

    async play(track_id) {
        await Queue.add_track(track_id);

        // Do nothing if stuff is playing, else start playing
        if (this.active)
            return;

        this.active = true;
        this.buffering = true;
        this.check_headroom();
    }

    pause() {
        this.paused = !this.paused;
    }

    set paused(val) {
        // If nothing can play, dont let it happen
        if (!this.active || this.buffering)
            return;
        
        this._paused = val;

        if (this.paused) {
            this.context.suspend();
            UI.controls_div.classList.add("paused");
        } else {
            this.context.resume();
            UI.controls_div.classList.remove("paused");
            requestAnimationFrame(UI.update_seekbar);
        }
    }

    get paused() {
        return this._paused;
    }

    set headroom(num) {
        this._headroom = num;
        this.check_headroom();
    }

    get headroom() {
        return this._headroom;
    }

    get buffering() {
        return this._buffering;
    }

    set buffering(val) {
        if (this.buffering != val)
            this._buffering = val;

        // Show loading
        UI.loading = this.buffering;
    }

    check_headroom() {
        if (this.headroom < this.desired_headroom)
            this.get_next_buffer();
    }

    attach_time_event(time, callback) {
        // Add the event
        const num = this.events.length;
        this.events.push({
            time: time,
            callback: callback
        });

        function check(once) {
            //console.log("chcking!");
            const event_buf = this.events.slice(0); // So we dont mess up the REAL array when removing shit
            const current_time = this.context.currentTime;

            for (let i = 0; i < event_buf.length; i++) {
                const event = event_buf[i];
                if (current_time < event.time)
                    continue; // Not now!

                // Call it and remove!
                event_buf[i].callback();
                this.events.splice(i, 1);
            }

            if (this.events.length != 0 && !once)
                requestAnimationFrame(check);
        }

        check = check.bind(this);

        // If no check is running rn, start it
        if (num == 0) {
            check();
        } else {
            check(true); // or check once for good measure
        }
    }

    async get_next_buffer() {
        // Figure out what the next buffer is. (check track block quantity, and then queue)
        const { track_id, track_index, block_index } = Queue.next();
        if (!track_id)
            return; // No more to be played!

        const track = Queue.tracks[track_index];

        const start = performance.now(); // Timing
        
        // Request it (get from cache or server)
        const data = await Comms.get_buffer({
            track_id: track_id,
            block_index: block_index,
            format: 1 // Flac MAX delicuiussy
        });

        const transfer = performance.now(); // Timing

        // Decode
        const decoded = await this.decode_data(data);
        if (decoded.error) {
            console.error(decoded.error)
            return; // make sure it stops idk
        }

        const decode = performance.now(); // Timing

        // Create source and set to start
        const source = await this.create_source(decoded.channelData, decoded.samplesDecoded, decoded.sampleRate);
        const start_time = Queue.time_offset + Queue.current.get_block_time(block_index);
        source.start(start_time);

        // info
        if (this.debug) {
            document.querySelector("#debug-info").innerHTML += `<p id="bi${block_index}">
                                                                    Block #${block_index}<br>
                                                                    Start: ${Math.round(start_time * 100) / 100}s
                                                                </p>`;
        }

        // Update headroom
        this.headroom++;
        const index = this.sources.push(source);

        // Check buffering
        if (this.buffering && this.headroom == this.desired_headroom) {
            this.buffering = false;
            this.paused = false;
        }

        // Tell track when it started
        if (block_index == 0)
            Queue.tracks[track_index].start_time = start_time;

        // Started
        this.attach_time_event(start_time, () => {
            if (this.debug) {
                const elem = document.querySelector(`#debug-info > #bi${block_index}`)
                if (elem)
                    elem.setAttribute("class", "playing");
            }

            // When track starts
            if (block_index == 0) {
                // Set playing index
                Queue.playing_index = track_index;

                // Set up seekbar
                UI.start_seekbar(track.duration);

                // Show track info
                UI.set_info(track);
            }
        });

        // Ended
        source.addEventListener("ended", () => {
            this.headroom--;

            if (this.debug)
                document.querySelector(`#debug-info > #bi${block_index}`).setAttribute("class", "done");
            
            // Pause when out of buffers
            if (this.headroom == 0) {
                this.paused = true;

                // Set inactive when queue done
                console.log(`Num tracks ${Queue.tracks.length} this track indexs ${track_index}\nBlock index ${block_index} num blocks ${track.num_blocks}`);
                if (Queue.tracks.length - 1 == track_index && block_index == track.num_blocks - 1) {
                    this.active = false;
                    UI.clear_info();
                    UI.clear_seekbar();
                } else {
                    // Or set buffering when not done!
                    this.buffering = true;
                }
            }

            // Remove shit
            this.sources.splice(index);
            delete source.buffer;

            // Remove a previous one
            const old = document.querySelector(`#debug-info > #bi${block_index - 2}`);
            if (old)
                old.remove();
            
        });
    }

    async decode_data(data) {
        const data_view = new DataView(data);

        const format = data_view.getUint8(2); // IIFN
        if (format == 0) // NO DATA
            return {error: "No data present in this buffer."};
        
        // Split data into frames
        let frames = [];
        const frame_count = data_view.getUint8(3);
        const metadata_size = 4 + frame_count * 2; // 6 bytes of metdata and then 2 * n bytes of lengths

        let offset = metadata_size;
        for (let i = 0; i < frame_count; i++) {
            // Get and push frame to array
            const length = data_view.getUint16(4 + i * 2, true);
            frames.push(new Uint8Array(data, offset, length));
            offset += length;
        }

        // Decode data
        if (!this.decoders.flac.ready)
            return;

        const decoded = await this.decoders.flac.decodeFrames(frames);

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
        for (let i = 0; i < this.sources; i++) {
            const source = this.sources[i];
            source.stop(0);
            delete source.buffer;
        }

        this.sources = [];
    }
}

// Load decoders
await Stream.load_decoders();

export default Stream;
window.stream = Stream;


// Clear UI
UI.clear_info();

// Attach events
document.querySelector("#pause").addEventListener("click", () => {
    Stream.pause();
});

document.addEventListener("keyup", (event) => {
    if (event.key == " ")
        Stream.pause();
})

document.getElementById("lastfm-copy").addEventListener("click", () => {
   // Get the text field
  const copyText = document.getElementById("lastfm");

  // Select the text field
  copyText.select();
  copyText.setSelectionRange(0, 99999); // For mobile devices

   // Copy the text inside the text field
  document.execCommand('copy');
});
