// Shows stuff in the library. Search for tracks, albums and artists, and show album tracklist.

const Library = new class {
    constructor() {
        this.search_bar = document.querySelector("#library > #search");
        this.body = document.querySelector("#library > #body");
    }

    clear() {
        this.body.innerHTML = "";
    }

    // Add a track to be displayed in the library
    add_track(track_data) {
        const box = document.createElement("div");
        box.classList.add("trackbox");
        //box.style.backgroundImage = `url("/album/${track_data.album.id}/256.jpg")`;
        
        const cover = document.createElement("img");
        cover.src = `/album/${track_data.album.id}/${96 * window.devicePixelRatio}.jpg`;

        const info = document.createElement("div");

        const title = document.createElement("p");
        title.innerText = track_data.track.name;
        title.classList.add("title");

        const artist = document.createElement("p");
        artist.innerText = `Track by ${track_data.artist.name}`;
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
            window.start_track(track_data.track.id);
        });

        this.body.appendChild(box);
    }
}

window.library = Library;
export default Library;

Library.add_track({track: {name: "The Girl Who Fell From the Sky", id: 59}, album: {name: "Laputa: Castle in the Sky Soundtrack -The Mystery of the Levitation Stone-", id: 7}, artist: {name: "Joe Hisashi"}})