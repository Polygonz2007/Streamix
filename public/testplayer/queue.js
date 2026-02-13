
import Utils from "/util.js";
import Comms from "/comms.js";
import Controller from "./controller.js";

const Track = class {
    constructor(track_id) {
        this.loaded = false;
        this.track_id = track_id;
        this.index = -1;
        
        this.load();
    }

    async load() {
        const data = await Comms.fetch_json(`/track/${this.track_id}`);
        if (!data)
        return false;

        this.track = data.track;
        this.album = data.album;
        this.artists = data.artists;
        this.album_artist = data.album_artist;

        this.loaded = true;
        return true;
    }
}
window.track = Track;

const Queue = new class {
    constructor() {
        this.tracks = [];
    }

    add(track, pos) { // Adds a track and shifts positions of other tracks to
        // Do any necessary shifting
        if (pos !== undefined) {
            for (let i in this.tracks) {
                if (this.tracks[i].index >= pos)
                    this.tracks[i].index++;
            }
        }
        
        // Add track in place
        track.index = (pos !== undefined) ? pos : this.tracks.length;
        this.tracks.splice(track.index, 0, track);
        return;
    }

    remove(pos) {
        if (pos === null) return;
        if (this.tracks.length == 0) return;

        // Remove track
        const c_pos = Controller.track.index;
        this.tracks.splice(pos, 1);

        // Shift item indecies
        for (let i in this.tracks) {
            if (this.tracks[i].index > pos)
                this.tracks[i].index--;
        }

        // Keep playing if active was removed
        if (c_pos == pos)
            Controller.play(Queue.tracks[c_pos]);

        return;
    }
}

export default Queue;
window.queue = Queue;

// Test casing
const num_tracks = 468;//Math.ceil(Math.random() * 20);
for (let i = 0; i < num_tracks; i++) {
    const track_id = i+1;//Math.ceil(Math.random() * 354);
    Queue.add(new Track(track_id));
}