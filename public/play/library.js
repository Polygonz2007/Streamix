
import Comms from "/comms.js";

import { Queue, Item } from "./queue.js";
import Utils from "/util.js";

const Library = new class {
    constructor() {
        // Searching
        this.page = 0;
        this.page_size = 8;
        this.filter = {
            artists: true,
            collections: true,
            items: true
        };
        
        // UI elements
        this.elements = {
            searchbox: document.querySelector("#search > input"),
            results: document.querySelector("#library > #results")
        }

        // Events
        this.elements.searchbox.addEventListener("keyup", () => { this.refresh() });

        this.refresh();
    }

    async refresh() {
        const string = this.elements.searchbox.value;
        if (string == "") {
            this.elements.results.innerHTML = "";
            return false;
        }

        // Make request
        const results = await Comms.post_json("/search", {
            string: string,
            page: this.page,
            page_size: this.page_size
        });

        // Display results
        this.elements.results.innerHTML = `<p>${results.creators.length} creators, ${results.collections.length} collections, and ${results.items.length} items.</p>`;
        this.elements.results.innerHTML += "<p>Creators:</p>";
        for (let i = 0; i < results.creators.length; i++) {
            this.elements.results.innerHTML += `<li><img src="/asset/icon/Creator.svg" /><span>${results.creators[i].name}</span></li>`;
        }
        this.elements.results.innerHTML += "<p>Collections:</p>";
        for (let i = 0; i < results.collections.length; i++) {
            const collection = results.collections[i];
            this.elements.results.innerHTML += `<li><img src="/collection/${collection.id}/image" /><span>${collection.name}</span></li>`;
        }
        this.elements.results.innerHTML += "<p>Tracks:</p>";
        for (let i = 0; i < results.items.length; i++) {
            const item = results.items[i];
            const track = item.track;
            const li = document.createElement("li");

            const img = document.createElement("img");
            (async () => { // Fill in image when possible TODO: use caching instead
                img.src = `/collection/${(await Comms.fetch_json(`/item/${item.id}`)).collection.id}/image`;
            })();

            const title = document.createElement("span");
            title.innerHTML = `${track.number}. ${track.name}`;

            const duration = document.createElement("span");
            duration.innerHTML = `${Utils.seconds_to_mmss(track.duration)}`;
            duration.classList.add("color-light");
            duration.classList.add("duration");

            const input = document.createElement("input");
            input.type = "button";
            input.value = "Queue";
            input.id = `item${results.items[i].id}`;
            input.addEventListener("click", () => { Queue.add(new Item(results.items[i].id)); });

            li.appendChild(img);
            li.appendChild(title);
            li.appendChild(duration);
            li.appendChild(input);
            this.elements.results.appendChild(li);
        }
        //this.elements.results.innerHTML += "</ul>";
    }
}

export default Library;
