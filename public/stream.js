
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

        this.frame_index = -1;
        this.start_time = 0;
    }

    async load() {
        // Prevent double loading
        if (this.loaded)
            return false;

        // Fetch data
        const track_meta = await Comms.fetch_json(`/track/${this.id}`);

        // Store info we have so far
        this.sample_rate = 0;
        this.duration = 0;
        this.seek_offset = 0;
        this.num_frames = 0;

        this.title = track_meta.track.name;
        this.album = track_meta.album;
        this.artists = track_meta.artists;
        this.album_artist = track_meta.album_artist;

        this._resolve();
        this.loaded = true;
        this.loaded_fmt = false;
    }

    get_block_time(frame_index) {
        if (frame_index < 0 || frame_index > this.num_frames)
            return 0;

        if (Stream.format <= 2)
            return frame_index * ((5760) / this.sample_rate);
        else
            return frame_index * ((2880) / this.sample_rate);
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
        // Track durations and seeking offsets for all previous tracks
        let offset = 0;
        for (let i = 0; i < this.active_index; i++) {
            offset += this.tracks[i].duration - this.tracks[i].seek_offset;
        }

        // And seeking offset for this track!
        offset -= this.current.seek_offset;

        return offset;
    }

    next() {
        // Is there anything to play lol
        if (!this.current)
            return false;

        // Next track
        const scaled_frame_index = Stream.format <= 2 ? Math.floor(this.current.frame_index / 2) : this.current.frame_index;
        if (this.active_index < 0 || scaled_frame_index >= this.current.num_frames)
            this.active_index++;

        const current_track = this.current;
        if (!current_track)
            return false;

        if (current_track.frame_index != -1)
            current_track.frame_index += Stream.format <= 2 ? 2 : 1; // Increment by 2 if flac.
        else
            current_track.frame_index = 0; // Start correct please.

        return {
            track_id: current_track.id,
            frame_index: current_track.frame_index,
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

export const MediaSession = new class {
    constructor() {
        return this;
    }

    set(track) {
        console.log("DOIN MEDIA SESH")

        if (!navigator.mediaSession)
            return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.album_artist.name,
            album: track.album.name,
            artwork: [
                {
                    src: `/album/${track.album.id}/1024.jpg`,
                    sizes: "1024x1024",
                    type: "image/jpg"
                }
            ]
        });

        navigator.mediaSession.setActionHandler("play", () => {
            Stream.paused = false;

            navigator.mediaSession.setPositionState({
                duration: track.duration,
                playbackRate: 1,
                position: Stream.played_time,
                state: "playing"
            });
        });

        navigator.mediaSession.setActionHandler("pause", () => {
            Stream.paused = true;

            navigator.mediaSession.setPositionState({
                duration: track.duration,
                playbackRate: 1,
                position: Stream.played_time,
                state: "paused"
            });
        });

        navigator.mediaSession.setPositionState({
            duration: track.duration,
            playbackRate: 1,
            position: 0,
            state: "playing"
        });
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
        this.format = 0; // We dont know what format we can use yet
        this.req_format = 3; // The format we want to use, but may not have switched yet
        this.formats = [
            "No data",
            "Max [Flac]",
            "CD [Flac]",
            "High [Opus, 384 kbps]",
            "Medium [Opus, 192 kbps]",
            "Low [Opus, 96 kbps]",
            "Trash [Opus, 24 kbps]"
        ]

        // Debug
        this.debug = true;

        // Playback
        this.active = false; // If false, no song is up next and therefore nothing can play
        this.paused = true; // If playback is occuring
        this.buffering = false; // Wait until headroom is topped before playback.
        this.seeking = false;
        
        this.volume = 1;
        this.buffer_time = 0;
        this.frame_index = 0;

        this.track_id;

        // Global playback data
        this.desired_headroom = 192; // How many buffers to load in advance
        this._headroom = 0; // How many buffers are loaded after the current one

        this.sources = [];
        this.events = [];
    }

    async load_decoders() {
        // get
        const { FLACDecoder, FLACDecoderWebWorker } = window["flac-decoder"];
        const { OpusDecoder, OpusDecoderWebWorker } = window["opus-decoder"];

        // create
        this.decoders = {};
        this.decoders.flac = new FLACDecoderWebWorker(); //new FLACDecoder();
        this.decoders.opus = new OpusDecoderWebWorker(); //new OpusDecoder();

        // load
        await this.decoders.flac.ready;
        await this.decoders.opus.ready;

        // Good!
        console.log("Flac and Opus decoders loaded!");
    }

    async play(track_id) {
        console.log(`Adding #${track_id} to queue`);
        await Queue.add_track(track_id);

        // Do nothing if stuff is playing, else start playing
        if (this.active)
            return;

        console.log(`Playing #${track_id} immediatley`);

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

    async seek(time) {
        const track = Queue.current;
        if (!track)
            return; // Nothing to seek

        // Check if time is within tracks length
        if (time < 0)
            time = 0;

        if (time >= track.duration)
            time = track.duration;

        // Calculate frame index (floored)
        const frame_index = Math.floor(time / ((this.format <= 2 ? 5760 : 2880) / track.sample_rate));

        // Ask server very nicley
        const result = await Comms.ws_req({
            type: 4, // Seek
            frame_index: frame_index
        });

        // Check if we are allowed
        const buffer_view = new DataView(result);
        const seek_result = buffer_view.getUint16(2, true);

        if (!seek_result)
            return;  // Womp, maybe try again

        // We can. Pause, update, and buffer.
        this.paused = true;
        this.seeking = true;

        // Get frame_index before seek
        const current_time = this.context.currentTime - Queue.time_offset;
        const prev_frame_index = Math.floor(current_time / ((this.format <= 2 ? 5760 : 2880) / track.sample_rate));
        const diff = frame_index - prev_frame_index;
        const seek_duration = diff * ((this.format <= 2 ? 5760 : 2880) / track.sample_rate); // Difference multiplied by duration of each frame

        console.log(`DIFF ${diff}\nSEEKDUR ${seek_duration}s\n\nPREV ${prev_frame_index} NEW ${frame_index}`);

        // Yes, now update frame index and seek offset and headroom
        track.frame_index = frame_index;
        track.seek_offset += seek_duration;
        
        this.flush(); // Get rid of all old buffers
        this.buffering = true; // Wait until we can play agaiun
        this.seeking = false;
        this.headroom = 0; // Restart process of getting buffers
    }

    goto(track_index) {
        if (track_index < 0) return;
        if (track_index >= Queue.tracks.length) return;

        this.paused = true;
        this.seeking = true;

        Queue.active_index = track_index;
        Queue.current.frame_index = 0;

        this.flush(); // Get rid of all old buffers
        this.buffering = true; // Wait until we can play agaiun
        this.seeking = false;
        this.headroom = 0; // Restart process of getting buffers
    }

    next() {
        this.goto(Queue.playing_index + 1);
    }

    previous() {
        this.goto(Queue.playing_index - 1);
    }

    get played_time() {
        const start_time = Queue.playing.start_time; // Replace with getting the one that is displayed.
        const current_time = Stream.context.currentTime;

        return current_time - start_time;
    }

    set headroom(num) {
        if (num < 0)
            return;

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
        // Figure out what the next buffer is.
        const { track_id, track_index, frame_index } = Queue.next();
        if (!track_id)
            return; // No more to be played!

        const track = Queue.tracks[track_index];
        const scaled_frame_index = Stream.format <= 2 ? Math.floor(frame_index / 2) : frame_index;

        // Switch track
        if (scaled_frame_index == 0) {
            const fmt = await Comms.ws_req({
                type: 1,
                track_id: track.id
            });

            if (!track.loaded_fmt) { // Set format stuff for the track
                const buffer_view = new DataView(fmt);

                track.max_sample_rate = buffer_view.getUint32(2, true); // MAX SAMPLE RATE
                track.duration = buffer_view.getFloat32(6, true); // DURATION
            }

            console.log(`Changed track to #${track.id}`);
        }

        // See if we need to change format
        if ((frame_index % 2 == 0 && this.format != this.req_format) || frame_index == 0) { // Start of track, or on format change
            // Check if it can happen
            const format_change = await Comms.ws_req({
                type: 2,
                format: this.req_format
            });

            // Get the format we requested, or highest possible
            const buffer_view = new DataView(format_change);
            const legal_format = buffer_view.getUint8(2);

            // Update it
            this.req_format = legal_format;
            this.format = legal_format;

            // Update samplereate
            if (this.format == 1)
                track.sample_rate = track.max_sample_rate;
            else if (this.format == 2)
                track.sample_rate = 44100;
            else if (this.format >= 3)
                track.sample_rate = 48000;

            // Update number of frames
            track.num_frames = Math.ceil(track.duration / ((this.format <= 2 ? 5760 : 2880) / track.sample_rate));
            console.log(`Track\nSAMPLE RATE ${track.sample_rate}\nFORMAT ${this.format}\nN_FRAMES ${track.num_frames}`);
        }

        const start = performance.now(); // Timing
        
        // Request it (get from cache or server)
        const data = await Comms.ws_req({
            type: 0, // get buffer
            format: this.format // of the correct format
        });

        const transfer = performance.now(); // Timing

        // Decode
        const decoded = await this.decode_data(data, this.format);
        if (decoded.error) {
            console.log("deocde error")
            console.error(decoded.error)
            return; // make sure it stops idk
        }

        const decode = performance.now(); // Timing

        // Create source and set to start
        const source = await this.create_source(decoded.channelData, decoded.samplesDecoded, track.sample_rate);
        const start_time = Queue.time_offset + track.get_block_time(scaled_frame_index);
        source.start(start_time);

        // info
        if (this.debug) {
            document.querySelector("#debug-info").innerHTML += `<p id="bi${scaled_frame_index}">
                                                                    Preparing frame #${scaled_frame_index} on track #${track.id}<br>
                                                                    Format: ${this.formats[this.format]}<br>
                                                                    Start time: ${start_time.toFixed(2)}s
                                                                </p>`;
        }

        // Update headroom
        this.headroom++;
        const index = this.sources.push(source);

        // Check buffering
        if (this.buffering && this.headroom >= this.desired_headroom) {
            console.log("DONE BUFFERING")
            this.buffering = false;
            this.paused = false;
        }

        // Tell track when it started
        if (scaled_frame_index == 0)
            Queue.tracks[track_index].start_time = start_time;

        // Started
        this.attach_time_event(start_time, () => {
            // When track starts
            if (scaled_frame_index == 0) {
                // Set playing index
                Queue.playing_index = track_index;

                // Set up seekbar
                UI.start_seekbar(track.duration);

                // Show track info
                UI.set_info(track);
                MediaSession.set(track);
            }
        });

        // Ended
        source.addEventListener("ended", () => {
            // Do not cause chaos if we are seeking
            if (this.seeking)
                return;

            this.headroom--;

            // Pause when out of buffers
            if (this.headroom == 0) {
                this.paused = true;

                // Set inactive when queue done
                console.log(`Num tracks ${Queue.tracks.length} this track indexs ${track_index}\nFrame index ${scaled_frame_index} num frames ${track.num_frames}`);
                if (Queue.tracks.length - 1 == track_index && scaled_frame_index == track.num_frames - 1) {
                    this.active = false;
                    UI.clear_info();
                    UI.clear_seekbar();
                } else {
                    // Or set buffering when not done!
                    this.buffering = true;
                }
            }

            // Remove shit (the newest one because we dont know hat order they are in?!?!?)
            //this.sources.splice(0);
        });
    }

    async decode_data(data, format) {
        const frame = new Uint8Array(data, 2);

        // Decode data
        if (format <= 2) {
            // FLAC
            if (!this.decoders.flac.ready)
                return;

            return await this.decoders.flac.decodeFrames([frame]); // Does not have decodeFrame for some reason..
        } else if (format <= 6) {
            // OPUS
            if (!this.decoders.opus.ready)
                return;

            return await this.decoders.opus.decodeFrames([frame]);
        }
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
        console.log(`flushing away ${this.sources.length} sources`)
        for (let i = 0; i < this.sources.length; i++) {
            const source = this.sources[i];
            //source.playbackRate.value = 10000; // hogogogo

            source.stop();
            source.disconnect();
            //delete this.sources[i];
        }

        this.sources = [];
    }
}

// Load decoders
await Stream.load_decoders();

export default Stream;
window.stream = Stream;
window.queue = Queue;


// Clear UI
UI.clear_info();

// temp
document.getElementById("lastfm-copy").addEventListener("click", () => {
   // Get the text field
  const copyText = document.getElementById("lastfm");

  // Select the text field
  copyText.select();
  copyText.setSelectionRange(0, 99999); // For mobile devices

   // Copy the text inside the text field
  document.execCommand('copy');
});
