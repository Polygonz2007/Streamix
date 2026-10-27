
const Display = new class {
    constructor() {
        this.elements = {
            "image": document.querySelector(".info img"),
            "title": document.querySelector(".info #title"),
            "collection": document.querySelector(".info #collection"),
            "creator": document.querySelector(".info #creator"),

            "controls": document.querySelector("#controls")
        }

        // Seekbar
        this.seekbar_update_interval = 0.1;
    }

    set_item(item) {
        if (!item)
            return; 

        // Generate artist html
        let creators_html = "<span>by </span>";
        const num_creators = item.creators.length;

        for (let i = 0; i < num_creators; i++) {
            // Add spacings
            if (num_creators > 1) {
                if (i == num_creators - 1)
                    creators_html += "<span> and </span>";
                else if (i > 0)
                    creators_html += "<span>, </span>";
            }

            // Add artist name
            creators_html += `<a>${item.creators[i].name}</a>`
        }

        // Set text
        this.elements.title.innerHTML = item.track.name;
        this.elements.creator.innerHTML = creators_html;
        this.elements.collection.innerHTML = `<span>from </span><a>${item.collection.name}</a>`;

        // Set image
        this.elements.image.src = `/collection/${item.collection.id}/image`;

        return true;
    }

    clear_item() {
        this.elements.title.innerHTML = "Title [Number / Total]";
        this.elements.creator.innerHTML = "Creator(s)";
        this.elements.collection.innerHTML = `Collection`;

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
        this.clear_item();
        this.elements.title.innerHTML = text;
        return true;
    }
}

export default Display;

window.display = Display;