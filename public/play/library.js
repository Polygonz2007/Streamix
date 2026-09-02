
import Comms from "/comms.js";

import { Queue, Item } from "./queue.js";

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
        this.elements.results.innerHTML = `<p>${results.creators.length} creators, ${results.collections.length} collections, and ${results.items.length} items.`;
        this.elements.results.innerHTML += "<p>Creators:<p><ul>";
        for (let i = 0; i < results.creators.length; i++) {
            this.elements.results.innerHTML += `<li><img src="/asset/icon/Creator.svg" /><span>${results.creators[i].name}</span></li>`;
        }
        this.elements.results.innerHTML += "</ul><p>Collections:<p><ul>";
        for (let i = 0; i < results.collections.length; i++) {
            const collection = results.collections[i];
            this.elements.results.innerHTML += `<p><img src="/collection/${collection.id}/image" /><span>${collection.name}</span></p>`;
        }
        this.elements.results.innerHTML += "</ul><p>Tracks:<p><ul>";
        for (let i = 0; i < results.items.length; i++) {
            const item = results.items[i];
            const track = item.track;
            const li = document.createElement("li");

            const img = document.createElement("img");
            img.src = `/collection/${(await Comms.fetch_json(`/item/${item.id}`)).collection.id}/image`;

            const span = document.createElement("span");
            span.innerHTML = `${track.number}. ${track.name}`;

            const input = document.createElement("input");
            input.type = "button";
            input.value = "Queue";
            input.id = `item${results.items[i].id}`;
            input.addEventListener("click", () => { Queue.add(new Item(results.items[i].id)); });

            li.appendChild(img);
            li.appendChild(span);
            li.appendChild(input);
            this.elements.results.appendChild(li);
        }
        //this.elements.results.innerHTML += "</ul>";
    }
}

export default Library;
