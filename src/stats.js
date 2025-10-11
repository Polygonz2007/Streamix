// Handles logging and storing and stuff of statistics.

import { existsSync, readFileSync, stat, writeFileSync } from "fs";
import { json } from "stream/consumers";

// For now only per session!
// TODO: Convert to a class

const stats_path = "./stats.json";

const Stats = new class {
    constructor() {
        this.stats = {};
    }

    async load() {
        // Load stats
        if (!existsSync(stats_path))
            return;

        let data = readFileSync(stats_path);
        data = JSON.parse(data);
        this.stats = data;
    }

    async log(event, amount) {
        if (!amount)
            amount = 1;

        if (!this.stats[event])
            this.stats[event] = 0;

        this.stats[event] += amount;

        return;
    }

    async save() {
        const data = JSON.stringify(this.stats, null, 2);
        writeFileSync(stats_path, data);
    }

    get_json() {
        return JSON.stringify(this.stats);
    }
}

export default Stats;