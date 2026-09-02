
import Settings from "./settings.js";
import Queue from "./queue.js";
// import item object
import Stream from "./stream.js";
import Display from "./display.js";

const Controller = new class {
    constructor() {
        /// PLAYBACK ///
        this._playing = false;
        this.autoplay = true; // Go to next item when previous is done
        this.item;

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

    async play(item) {
        // Handle items not existing
        if (!item && this.item) {
            Display.clear_item();
            this.item = undefined;
            this.playing = false;
            return;
        } else if (!item && !this.item) {
            if (Queue.items.length == 0)
                return;

            item = Queue.items[0];
        }

        this.item = item;

        // Not tweak out when item hasnt loaded
        if (!item.loaded) {
            this.playing = false;
            Display.error("item not loaded");
            return;
        }

        const { group_id } = await Stream.set_state(this.item.id, null, 0);
        Stream.time_offset += (Stream.time - Stream.time_offset);
        Stream.keep_group(group_id);
        Stream.context.resume();
        this.playing = true;

        Display.set_item(item);

        // debug
        document.querySelector("#queue-info").innerHTML = `${item.index + 1} / ${Queue.items.length}`
    }

    async pause() {
        if (this.item) {
            this.playing = !this.playing;
            if (this.playing)
                Stream.context.resume();
            else
                Stream.context.suspend();
            
            return;
        }

        if (Queue.items.length > 0)
            this.play(Queue.items[0]);
    }

    async previous() {
        if (!this.item) {
            this.play(Queue.items[Queue.items.length - 1]); // Play last
        } else {
            this.play(Queue.items[this.item.index - 1]); // Play previous
        }

        
    }

    async next() {
        if (!this.item) {
            this.play(Queue.items[0]); // Play first
        } else {
            this.play(Queue.items[this.item.index + 1]); // Play next
        }
    }

    async goto(index) {
        if (index > 0 && index < Queue.items.length)
            this.play(Queue.items[index]);
    }
}

export default Controller;
window.controller = Controller
