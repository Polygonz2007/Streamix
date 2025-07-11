
// This module is responsible for handling database interaction by the app, in a safe and proper way.

import * as stats from "./stats.js";
import fs from "fs";

import sqlite3 from "better-sqlite3";
let db;

//const bcrypt = require("bcrypt");
//const salt_rounds = 10;

// Setup the database
export function setup() {
    const setup_file = "./src/streamix.sql";
    const setup_string = fs.readFileSync(setup_file).toString();

    const queries = setup_string.split(";");

    for (let i = 0; i < queries.length - 1; i++) { // everything except last empty query
        db.prepare(queries[i]).run();
    }

    return true;
}

export function open() {
    // Check if database is present, if not, create one (.gitignore)
    if (!fs.existsSync(process.env.db_path)) {
        console.log("Database not present, creating one...");
        fs.openSync(process.env.db_path, "w");
    
        db = sqlite3(process.env.db_path);
        db.pragma('journal_mode = WAL');
        const result = this.setup();
    
        if (!result) {
            fs.unlink(process.env.db_path, (err) => {
                console.log("Error deleting database file, do it manually instead.");
            });
    
            throw new Error("Database could net be set up properly. Aborting!");
        }
    
        console.log("Database sucessfully initiated.");
    }

    if (!db) {
        db = sqlite3(process.env.db_path);
        db.pragma('journal_mode = WAL');
    }
    
    return true;
}





// Artists
export function create_artist(name) {
    // Add
    const query = db.prepare("INSERT INTO artists (name) VALUES (?)");
    const result = query.run(name);
    if (result.changes == 0)
        return false;

    return result.lastInsertRowid;
}

// Fetches artist info by id.
export function get_artist(id, options) {
    
}

// Returns an ID if the artist exists, if not, returns false.
export function get_artist_name(name) {
    // Search for artist by name
    const query = db.prepare("SELECT id FROM artists WHERE artists.name = ?");
    const result = query.get(name);
    if (!result)
        return false;

    return result.id;
}

// Albums
export function create_album(name, artist_id) {
    // Add
    const query = db.prepare("INSERT INTO albums (name, artist_id) VALUES (?, ?)");
    const result = query.run(name, artist_id);
    if (result.changes == 0)
        return false;

    return result.lastInsertRowid;
}

export function get_album_name(name) {
    // Search for artist by name
    const query = db.prepare("SELECT id FROM albums WHERE albums.name = ?");
    const result = query.get(name);
    if (!result)
        return false;

    return result.id;
}

// Tracks
export function create_track(name, number, album_id, path, metadata) {
    const query = db.prepare("INSERT INTO tracks (name, number, album_id, path, length, bitrate) VALUES (?, ?, ?, ?, ?, ?)");
    const result = query.run(name, number, album_id, path, metadata.length, metadata.bitrate);
    if (result.changes == 0)
        return false;

    return result.lastInsertedRowId;
}

export function get_track_path(id) {
    const query = db.prepare("SELECT path FROM tracks WHERE tracks.id = ?");
    const result = query.get(id);
    if (result)
        return result.path;

    return false;
}

export function get_track_by_path(path) {
    const query = db.prepare("SELECT id FROM tracks WHERE tracks.path = ?");
    const result = query.get(path);
    if (result)
        return result.id;

    return false;
}