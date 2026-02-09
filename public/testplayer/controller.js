
import Settings from "./settings.js";
import Queue from "./queue.js";
// import track object
import Stream from "./stream.js";
import Display from "./display.js";

const Controller = new class {
    constructor() {
        /// PLAYBACK ///
        this._playing = false;
        this.autoplay = true; // Go to next track when previous is done
        this.track;

        /// INPUT ///
        this.buttons = {
            "pause": document.querySelector("#pause"),
            "previous": document.querySelector("#previous"),
            "next": document.querySelector("#next")
        }
        
        // Bind functions
        this.pause = this.pause.bind(this);
        this.previous = this.previous.bind(this);
        this.next = this.next.bind(this);

        // Add events
        this.buttons.pause.addEventListener("click", this.pause);
        this.buttons.previous.addEventListener("click", this.previous);
        this.buttons.next.addEventListener("click", this.next);

        // Keyboard shortcuts
        document.addEventListener("keyup", (e) => {
            // Make sure user is not typing.
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; // User is typing!

            // Controller shortcuts
            switch (e.key) {
                case Settings.keys.pause: this.pause(); break;
                case Settings.keys.next: this.next(); break;
                case Settings.keys.previous: this.previous(); break;
                case "H": Stream.context.resume(); break;
            }
        });
    }

    get playing() {
        return this._playing;
    }

    set playing(val) {
        this._playing = val;
        Display.set_playing(this.playing);
        document.querySelector("body").style.backgroundColor = this.playing ? "#121" : "#111";
    }

    play(track) {
        // Handle tracks not existing
        if (!track && this.track) {
            Display.clear_track();
            this.track = undefined;
            this.playing = false;
            return;
        } else if (!track && !this.track) {
            if (Queue.tracks.length == 0)
                return;

            track = Queue.tracks[0];
        }

        this.track = track;

        // Not tweak out when track hasnt loaded
        if (!track.loaded) {
            this.playing = false;
            Display.error("Track not loaded");
            return;
        }

        this.playing = true;
        Stream.track_id = this.track.track_id;
        Stream.test();
        // STREAM TELL STREAM TO DO STUFF HERE

        Display.set_track(track);

        // debug
        document.querySelector("#queue-info").innerHTML = `${track.index + 1} / ${Queue.tracks.length}`
    }

    pause() {
        if (this.track) {
            this.playing = !this.playing;
            return;
        }

        if (Queue.tracks.length > 0)
            this.play(Queue.tracks[0]);
    }

    previous() {
        if (!this.track) {
            this.play(Queue.tracks[Queue.tracks.length - 1]); // Play last
        } else {
            this.play(Queue.tracks[this.track.index - 1]); // Play previous
        }

        
    }

    next() {
        if (!this.track) {
            this.play(Queue.tracks[0]); // Play first
        } else {
            this.play(Queue.tracks[this.track.index + 1]); // Play next
        }
    }

    goto(index) {

    }
}

export default Controller;
window.controller = Controller
