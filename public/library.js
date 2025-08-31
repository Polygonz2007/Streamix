// Shows stuff in the library. Search for tracks, albums and artists, and show album tracklist.

import Comms from "./comms.js";
import Stream from "./stream.js";
import UI from "./ui.js";

const Library = new class {
    constructor() {
        this.library = document.querySelector("#library");
        this.search_bar = document.querySelector("#library > #search");
        this.body = document.querySelector("#library > #body");

        // Searching
        this.search(this.search_bar.value);
        this.search_bar.addEventListener("keyup", () => {
            this.search(this.search_bar.value);
        });
    }

    clear() {
        this.body.innerHTML = "";
    }

    // Add tracks to be displayed in the library
    show_tracks(tracks) {
        let fragment = document.createDocumentFragment();

        for (let i = 0; i < tracks.length; i++) {
            const track_data = tracks[i];

            const box = document.createElement("div");
            box.classList.add("trackbox");
            //box.style.backgroundImage = `url("/album/${track_data.album.id}/256.jpg")`;
            
            const cover = document.createElement("img");
            const cover_size = 96 * window.devicePixelRatio;
            let cover_url = UI.logo;
            if (track_data.album.cover)
                cover_url = `/album/${track_data.album.id}/${cover_size}.jpg`;

            cover.src = cover_url;

            const info = document.createElement("div");

            const title = document.createElement("p");
            title.innerText = track_data.track.name;
            title.classList.add("title");

            const artist = document.createElement("p");
            artist.innerText = `${track_data.album_artist.name}`;
            artist.classList.add("artist");

            const album = document.createElement("p");
            album.innerText = `${track_data.album.name}`;// - ${track_data.album.year || 2000}`;
            album.classList.add("album");

            info.appendChild(title);
            info.appendChild(artist);
            info.appendChild(album);

            box.appendChild(cover);
            box.appendChild(info);

            box.addEventListener("click", () => {
                Stream.play(track_data.track.id);
            });

            fragment.appendChild(box);
        }
        
        this.body.appendChild(fragment);
    }

    set loading(state) {
        if (state)
            this.library.classList.add("loading");
        else
            this.library.classList.remove("loading");
    }

    // Search
    async search(string) {
        this.clear();
        this.loading = true; //display loading thing

        const tracks = await Comms.post_json("/search", { "string": string });
        if (!tracks) {
            this.loading = false;
            this.body.innerHTML = "Not connected.";
            return;
        }

        //for (let i = 0; i < tracks.length; i++) {
        //    const track = tracks[i]; //await Comms.fetch_json(`/track/${tracks[i].id}`);
        //    //tracks_data.push(track);
        //}

        if (this.search_bar.value != string)
            return; // too slow bud

        this.show_tracks(tracks);
        this.loading = false;

        return tracks;
    }
}

export default Library;