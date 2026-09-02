
const Buffer = class {
    constructor(size) {
        this.item = [];
        this.item_status = [];
        this.size = size;
        this.writes = 0;

        // Init item statuses
        for (let i = 0; i < this.size; i++) {
            this.item_status[i] = -1; // Not occupied
        }
    }

    // Add and remove
    add(frame) {
        const index = this.#get_next_index();
        this.item[index] = frame;
        this.item_status[index] = this.writes;
        this.writes++;
        return index;
    }

    remove(index) {
        delete this.item[index];
        this.item_status[index] = -1;
        return true;
    }

    remove_group(group_id) {
        for (let i = 0; i < this.size; i++) {
            const frame = this.item[i];
            if (frame && frame.group_id == group_id)
                this.remove(i);
        }

        return true;
    }

    // Get data about item
    get amount() {
        let amount = 0;
        for (let i = 0; i < this.size; i++) {
            if (this.item_status[i] == -1)
                amount++;
        }

        return amount;
    }

    get newest() {
        let newest = false;
        let newest_time = 0;
        for (let i = 0; i < this.size; i++) {
            const frame = this.item[i];
            if (frame && frame.time.start > newest_time) {
                newest = frame;
                newest_time = frame.time.start;
            }
        }

        return newest;
    }

    /// PRIVATE ///
    #get_next_index() {
        let smallest = this.item_status[0];
        let smallest_index = 0;
        for (let i = 0; i < this.size; i++) {
            const status = this.item_status[i];
            if (status < smallest) {
                smallest = status;
                smallest_index = i;
            }
        }

        return smallest_index;
    }
}

export default Buffer;
