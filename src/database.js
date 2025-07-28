
// This module is responsible for handling database interaction by the app, in a safe and proper way.

import * as stats from "./stats.js";
import fs, { ftruncateSync } from "fs";

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
export function create_album(name, artist_id, album_image) {
    if (!album_image)
        album_image = null;

    // Add
    const query = db.prepare("INSERT INTO albums (name, artist_id, img) VALUES (?, ?, ?)");
    const result = query.run(name, artist_id, album_image);
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

export function get_album_image(id) {
    const query = db.prepare("SELECT img FROM albums WHERE albums.id = ?");
    const result = query.get(id);
    if (!result)
        return false;

    return result.img;
}

// Tracks
export function create_track(name, number, album_id, path, metadata) {
    const query = db.prepare("INSERT INTO tracks (name, number, album_id, path, duration, bitrate, sample_rate, num_blocks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    const result = query.run(name, number, album_id, path, metadata.duration, metadata.bitrate, metadata.sample_rate, metadata.num_blocks);
    if (result.changes == 0)
        return false;

    return result.lastInsertRowid;
}

export function get_track_meta(id) {
    // Get normal metadata
    const query = db.prepare(`SELECT 
                    tracks.id as track_id, tracks.name as track, tracks.number as track_number,
                    tracks.duration, tracks.bitrate, tracks.sample_rate, tracks.num_blocks,
                    albums.id as album_id, albums.name as album,
                    artists.id as artist_id, artists.name as artist
                FROM tracks
                INNER JOIN albums ON tracks.album_id = albums.id
                INNER JOIN artists ON albums.artist_id = artists.id
                WHERE tracks.id = ?`);
    let result = query.get(id);
    if (!result)
        return false;

    // Construct block data
    const block_query = db.prepare(`SELECT duration FROM track_data WHERE track_data.track_id = ? ORDER BY track_data.block_index ASC`);
    const block_result = block_query.all(id);
    if (!block_result)
        console.log("shi idk");

    const num_blocks = block_result.length;
    const blocks = new Float32Array(num_blocks);
    for (let i = 0; i < num_blocks; i++) {
        blocks[i] = block_result[i].duration;
    }

    // Add to metadata
    result.block_durations = blocks;

    return result;
}

export function get_all_track_meta() {
    const query = db.prepare(`SELECT 
                    tracks.id as track_id, tracks.name as track, tracks.number as track_number,
                    tracks.duration, tracks.bitrate, tracks.sample_rate, tracks.num_blocks,
                    albums.id as album_id, albums.name as album,
                    artists.id as artist_id, artists.name as artist
                FROM tracks
                INNER JOIN albums ON tracks.album_id = albums.id
                INNER JOIN artists ON albums.artist_id = artists.id`);
    const result = query.all();
    if (!result)
        return false;

    return result;
}

export function get_track_path(id) {
    const query = db.prepare("SELECT path FROM tracks WHERE tracks.id = ?");
    const result = query.get(id);
    if (!result)
        return false;

    return result.path;
}

export function get_track_by_path(path) {
    const query = db.prepare("SELECT id FROM tracks WHERE tracks.path = ?");
    const result = query.get(path);
    if (!result)
        return false;

    return result.id;
}

// Track data
export function create_track_data(track_id, format, index, duration, num_frames, block_size, data) {
    const query = db.prepare("INSERT INTO track_data (track_id, format, block_index, duration, num_frames, block_size, block_data) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const result = query.run(track_id, format, index, duration, num_frames, block_size, data);
    if (result.changes == 0)
        return false;

    return result.lastInsertRowid;
}

export function get_track_data(track_id, format, index) {
    format = 0;

    const query = db.prepare(`SELECT 
                                num_frames, block_size, block_data
                            FROM track_data 
                            WHERE 
                                track_data.track_id = ? 
                                AND track_data.format = ? 
                                AND track_data.block_index = ?`);
    const result = query.get(track_id, format, index);
    if (!result)
        return false;

    return result;
}