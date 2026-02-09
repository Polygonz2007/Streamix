
const Display = new class {
    constructor() {
        this.elements = {
            //"cover": document.querySelector("#album-cover"),
            "title": document.querySelector("#title"),
            "album": document.querySelector("#album"),
            "artist": document.querySelector("#artist"),

            "controls": document.querySelector("#controls")
        }
    }

    set_track(track) {
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
        this.elements.title.innerHTML = track.track.name;
        this.elements.artist.innerHTML = artist_html;
        this.elements.album.innerHTML = `<span>from </span><a>${track.album.name}</a>`;

        return true;
    }

    clear_track() {
        this.elements.title.innerHTML = "Title [Number / Total]";
        this.elements.artist.innerHTML = "Artist(s)";
        this.elements.album.innerHTML = `Album`;

        document.querySelector("#queue-info").innerHTML = `...`;
        return true;
    }

    set_playing(playing) {
        if (playing)
            this.elements.controls.classList.add("playing");
        else
            this.elements.controls.classList.remove("playing");
    }

    error(text) {
        this.clear_track();
        this.elements.title.innerHTML = text;
        return true;
    }
}

export default Display;

window.display = Display;