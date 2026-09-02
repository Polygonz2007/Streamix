
import Utils from "/util.js";
import Comms from "/comms.js";
import Controller from "./controller.js";
import Stream from "./stream.js";

export const Item = class {
    constructor(item_id) {
        this.loaded = false;
        this.id = item_id;
        this.index = -1;
        
        this.load();
    }

    async load() {
        const data = await Comms.fetch_json(`/item/${this.id}`);
        if (!data)
        return false;

        this.track = data.track;
        this.collection = data.collection;
        this.creators = data.creators;
        this.track_creators = data.track_creators;

        this.loaded = true;
        return true;
    }
}

export const Queue = new class {
    constructor() {
        this.items = [];
    }

    async add(item, pos) { // Adds a item and shifts positions of other items
        // Do any necessary shifting
        if (pos !== undefined) {
            for (let i in this.items) {
                if (this.items[i].index >= pos)
                    this.items[i].index++;
            }
        }
        
        // Add item in place
        if (pos === undefined)
            pos = this.items.length;
        
        item.index = (pos !== undefined) ? pos : this.items.length;
        this.items.splice(item.index, 0, item);

        // Display in html
        await item.load();
        document.querySelector("#queue").innerHTML += `<div><p>${item.track.name} by ${item.creators[0].name}</p><input type="button" onclick="controller.goto(${item.index});" value="Play" /></div>`;

        return;
    }

    remove(pos) {
        if (pos === null) return;
        if (this.items.length == 0) return;

        // Remove item
        const c_pos = Controller.item.index;
        this.items.splice(pos, 1);

        // Shift item indecies
        for (let i in this.items) {
            if (this.items[i].index > pos)
                this.items[i].index--;
        }

        // Keep playing if active was removed
        if (c_pos == pos)
            Controller.play(Queue.items[c_pos]);

        return;
    }
}

export default Queue;
window.queue = Queue;

// Test casing
//const num_items = 5;//Math.ceil(Math.random() * 20);
//for (let i = 0; i < num_items; i++) {
//    const item_id = i+1;//Math.ceil(Math.random() * 354);
//    Queue.add(new Item(item_id));
//}

//Queue.add(new Item(970));
//Queue.add(new Item(908));
//Queue.add(new Item(554));
//Queue.add(new Item(24));
//Queue.add(new Item(683));
//Queue.add(new Item(332));
//Queue.add(new Item(147));