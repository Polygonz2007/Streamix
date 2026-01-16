
// import queue
// import track object
// import stream

const Controller = new class {
    constructor() {
        /// PLAYBACK ///
        this.playing = false;
        this.autoplay = true; // Go to next track when previous is done
        this.queue_index = 0;

        /// INPUT ///
        this.buttons = {
            "pause": document.querySelector("#pause"),
            "next": document.querySelector("#next"),
            "previous": document.querySelector("#previous")
        }
        
        // Add events
        this.buttons.pause.addEventListener("click", this.pause);

        // Keyboard shortcuts
        window.addEventListener("keydown", (e) => {
            switch (e.key) {
                case " ": this.pause(); break;
                case ">": this.goto(); break;
                case "<": this.pause(); break;
            }
        });
    }

    pause() {
        console.log("Mad")
    }

    goto(index) {

    }
}

console.log("yeh")

export default Controller;
