
// Handles database interaction on a low level.

import Stats from "../stats.js";
import fs from "fs";

import { Database } from "bun:sqlite";
export let db;

// Setup the database
export function setup() {
    const setup_file = "./src/db/db.sql";
    const setup_string = fs.readFileSync(setup_file).toString();

    return db.run(setup_string);
}

export function open() {
    // Check if database is present, if not, create one (.gitignore)
    if (!fs.existsSync(process.env.db_path)) {
        console.log("Database not present, creating one...");
        fs.openSync(process.env.db_path, "w");
    
        db = new Database(process.env.db_path);
        db.run("PRAGMA journal_mode = WAL;");
        const result = this.setup();
    
        if (!result) {
            fs.unlink(process.env.db_path, (err) => {
                console.log("Error deleting database file, do it manually instead.");
            });
    
            throw new Error("Database could net be set up properly. Aborting!");
        }
    
        console.log("Database sucessfully created.");
    }

    if (!db) {
        db = new Database(process.env.db_path);
        db.run("PRAGMA journal_mode = WAL;");
    }
    
    return true;
}



// CREATOR


// CREATOR_TYPE


// CREATOR_IMAGE


// COLLECTION


// COLECTION_TYPE


// GENRE


// TRACK


// TRACK_GENRE
export function create_track_genre(track_id, genre_id) {
    // Create buffer array
    if (!Array.isArray(track_id))
        track_id = [track_id];

    if (!Array.isArray(genre_id))
        genre_id = [genre_id];

    // Error on mismatch
    if (track_id.length !== genre_id.length)
        return false;

    // Insert
    const insert = db.prepare("INSERT INTO track_genre(track_id, genre_id) VALUES ($track_id, $genre_id)")
    const result = db.transaction((track_id, genre_id) => {
        for (let i = 0; i < track_id.length; i++) {
            insert.run({ track_id: track_id[i], genre_id: genre_id[i] });
        }
    });

    console.log(result)
    return result;
}


// TRACK_CREATOR


// TRACK_FORMAT


// TRACK_FRAME