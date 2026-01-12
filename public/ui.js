// UI

import Background from "/background.js";
import { Stream, Queue } from "/stream.js";
import Utils from "/util.js";

const body = document.querySelector("body");

const Seekbar = new class {
    constructor() {
        this.time_played = document.querySelector("#time-played");
        this.time_remaining = document.querySelector("#time-remaining");
        
        this.div = document.querySelector("#seekbar");
        this.line = document.querySelector("#seekbar > #line");
        this.dot = document.querySelector("#seekbar > #dot");

        this._active = false; // Wether to render the dot or not.
        this._position = 0;
        this.duration = 1;
        this.bar_length = 0;

        // Seeking
        this.seeking = false;
        this.seeking_time = 0;

        // Seeking behaviour
        this.div.addEventListener("mousedown", () => {
            this.seeking = true;
            body.style.cursor = "grab";
            this.div.style.cursor = "grab";
        });

        body.addEventListener("mouseup", () => {
            if (!this.seeking)
                return;

            this.seeking = false;
            Stream.seek(this.seeking_time);
            body.style.cursor = "";
            this.div.style.cursor = "pointer";
        });
    }

    get position() {
        return this._position;
    }

    set position(val) {
        this._position = val;

        // calculate pixels
        const frac = this.position / this.duration;
        const length = Math.round(frac * this.bar_length);

        // Update dot
        this.dot.style.transform = `translate(calc(${length}px - 50%), -50%)`;

        // Update gradient
        const gradient = `linear-gradient(to right, 
                            var(--color-light) 0%,
                            var(--color-light) calc(${length}px - 0.7rem),
                            
                            #0000 calc(${length}px - 0.7rem),
                            #0000 calc(${length}px + 0.7rem),

                            var(--color-weak) calc(${length}px + 0.7rem),
                            var(--color-weak) 100%
                        )`
        this.line.style.background = gradient;
    }

    get progress() {
        return this.position / this.duration;
    }

    get active() {
        return this._active;
    }

    set active(val) {
        //if (this.active != val)
            this._active = val;

        this.dot.style.visibility = this.active ? "visible" : "hidden";
        this.line.style.backgroundColor = this.active ? "var(--color-weak)" : "var(--color-weak)";

        // Set size of seekbar
        this.bar_length = this.div.getBoundingClientRect().width;
    }
}

const Settings = new class {
    constructor() {
        //this.settings = {
        //    "Playback": {
        //        "Audio Quality": {
        //            type: "select",
        //            choices: ["Max", "CD", "High", "Mid", "Low", "Trash"],
        //            callback: Stream.set_req_format
        //        }
        //    }
        //}

        this.container = document.querySelector("#settings-container");
        this.menu = document.querySelector("#settings-menu");
        this.btn = document.querySelector("#settings");

        this.open = false;

        this.btn.addEventListener("click", () => {
            this.open = true;
            this.container.style.visibility = "visible";
        });

        this.container.addEventListener("click", () => {
            this.open = false;
            this.container.style.visibility = "hidden";
        });
    }
}

const UI = new class {
    constructor() {
        // Settings
        this.min_loading_time = 250; //250; // ms
        this._loading = false;

        // Assets
        this.logo = "/asset/logo/512/Winter.png";
        this.album_id;

        this.info_loaded = false;

        // Mouse
        this.mouse_pos = {x: 0, y: 0};
        document.addEventListener("mousemove", (e) => {
            this.mouse_pos = { x: e.clientX, y: e.clientY };
        });

        // Elements

        // Controls
        this.controls_div = document.querySelector("#controls");

        this.controls = {};
        this.controls.pause = document.querySelector("#pause");
        this.controls.next = document.querySelector("#next");
        this.controls.previous = document.querySelector("#previous");

        this.seekbar = Seekbar;

        // Info
        this.info = {};
        this.info.title = document.querySelector("#title");
        this.info.artist = document.querySelector("#artist");
        this.info.album = document.querySelector("#album");

        this.info.cover = document.querySelector("#album-cover");
        this.info.loading = document.querySelector("#loading");
        this.info.background = document.querySelector("#background");

        this.settings = Settings;

        // Vis
        const fft_length = 32;
        this.fft_data = new Float32Array(fft_length);

        // Request animation frame binding so it works
        this.update_seekbar = this.update_seekbar.bind(this);
    }

    get loading() {
        return this._loading;
    }

    set loading(val) {
        if (this.loading != val)
            this._loading = val;

        // Make sure it only shows loading when loading, AND after 100ms of loading time.
        if (this.loading) {
            setTimeout(() => {
                if (this.loading)
                    this.info.loading.style.opacity = "100%";
            }, this.min_loading_time);
        } else {
            this.info.loading.style.opacity = "0%";
        }
    }

    async set_info(track) {
        if (!track)
            return; 

        // Generate artist html
        let artist_html = "<span>by </span>";
        const num_artists = track.artists.length;

        for (let i = 0; i < num_artists; i++) {
            // Add spacings
            if (num_artists > 1) {
                if (i == num_artists - 1)
                    artist_html += "<span> and </span>";
                else if (i > 0)
                    artist_html += "<span>, </span>";
            }

            // Add artist name
            artist_html += `<a>${track.artists[i].name}</a>`
        }

        // Set text
        this.info.title.innerText = track.title;
        this.info.artist.innerHTML = artist_html;
        this.info.album.innerHTML = `<span>from </span><a>${track.album.name}</a>`;

        // Find album cover size
        const img_size = Math.ceil(this.info.cover.getBoundingClientRect().width * window.devicePixelRatio);

        // Set album cover
        const cover_url = `/album/${track.album.id}/${img_size}.jpg`;
        if (track.album.cover) {
            // Update image cover
            this.info.cover.setAttribute("src", cover_url);
            //this.info.cover.style.objectFit = "none"; // Render image sharp!
            //this.info.cover.style.scale = 1 / window.devicePixelRatio;

            // Update background
            Background.src = cover_url;
        } else {
            this.info.cover.setAttribute("src", this.logo);
            Background.src = "";
        }
        
        // Set tab title
        document.title = `Streamix - ${track.title} by ${track.album_artist.name}`;

        // Set last fm command
        document.querySelector("#lastfm").value = `.sb ${track.album_artist.name} | ${track.title} | ${track.album.name}`;

        this.info_loaded = true;
        this.album_id = track.album.id;
    }

    clear_info() {
        // Set text
        this.info.title.innerText = "Streamix";
        this.info.artist.innerHTML = `<span>Quality: </span><a>${Stream.formats[Stream.req_format]}</a>`;
        this.info.album.innerHTML = `<span>Cache: </span><a>Disabled</a>`;//0.00GB [0% full]</a>`;

        // Set album cover
        this.info.cover.setAttribute("src", this.logo);
        this.info.cover.style.objectFit = "unset"; // Logo scales
        Background.src = "";

        // Clear seekbar
        this.clear_seekbar();

        // Clear tab title
        document.title = `Streamix`;

        this.info_loaded = false;
        this.album_id = null;
    }

    start_seekbar(duration) {
        // Set texts
        this.seekbar.time_played.innerHTML = this.get_timestamp(0);
        this.seekbar.time_remaining.innerHTML = this.get_timestamp(-duration);

        // Set bar
        this.seekbar.active = true;
        this.seekbar.position = 0;
        this.seekbar.duration = duration;

        // Make it update
        requestAnimationFrame(this.update_seekbar);
    }

    update_seekbar() {
        // Stop if no longer needed
        if (!this.seekbar.active)
            return;

        // Keep it updated
        if (!Stream.paused)
            requestAnimationFrame(this.update_seekbar);

        let start_time = Queue.playing.start_time - Queue.playing.seek_offset;
        let current_time = Stream.context.currentTime;

        // Seeking
        if (this.seekbar.seeking) {
            // Update seeking time
            const { left, right } = this.seekbar.line.getBoundingClientRect();
            let percent = (this.mouse_pos.x - left) / (right - left);

            if (percent < 0) percent = 0;
            if (percent > 1) percent = 1;

            this.seekbar.seeking_time = percent * Queue.playing.duration;

            // Move bar to there
            start_time = Queue.playing.start_time;
            current_time = this.seekbar.seeking_time;
        }

        const played_time = current_time - start_time;
        const remaining_time = played_time - this.seekbar.duration;

        // Set texts
        this.seekbar.time_played.innerHTML = this.get_timestamp(played_time);
        this.seekbar.time_remaining.innerHTML = this.get_timestamp(remaining_time);

        // Set bar
        this.seekbar.position = played_time;

        // Vis
        Stream.analyser.getFloatFrequencyData(this.fft_data);
        let strength = Utils.clamp(this.fft_data[0] + 30, 0, 25) / 25;
        strength = Math.pow(strength, 2.2) * 32;
        //body.style.transform = `translate(${Math.round((0.5 - Math.random()) * strength)}px, ${Math.round((0.5 - Math.random()) * strength)}px)`;
        //document.querySelector("#background").style.filter = `brightness(${100 + strength * 4}%)`;
    }

    clear_seekbar() {
        // Set texts
        this.seekbar.time_played.innerHTML = this.get_timestamp(0);
        this.seekbar.time_remaining.innerHTML = this.get_timestamp(0);

        // Set bar
        this.seekbar.active = false;
        this.seekbar.position = 0;
        this.seekbar.duration = 1;
    }

    get_timestamp(seconds) {
        // Flip if negative
        let prefix = "";
        if (seconds < 0) {
            seconds = -seconds;
            prefix = "-";
        }

        // Get
        let m = Math.floor(seconds / 60);
        let s = Math.floor(seconds % 60);

        // Add leading 0s
        m = m.toString();
        s = s.toString();

        if (m.length === 1)
            m = "0" + m;
        if (s.length === 1)
            s = "0" + s;

        // Add - if negative
        return `${prefix}${m}:${s}`;
    }

    
}

export default UI;
window.ui = UI;


//  INPUT  //
// Buttons
UI.controls.pause.addEventListener("click", () => {
    Stream.pause();
});

UI.controls.next.addEventListener("click", () => {
    Stream.next();
});

UI.controls.previous.addEventListener("click", () => {
    Stream.previous();
});

// Keyboard
document.addEventListener("keyup", (event) => {
    // Make sure user is not typing.
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
        return; // User is typing!

    // Pause
    switch (event.key) {
        case " ": Stream.pause(); break;
        case ">": Stream.next(); break;
        case "<": Stream.previous(); break;
    }
        
})

// Touch (phone)