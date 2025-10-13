
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
export function create_album(name, artist_id, album_image, year) {
    if (!album_image)
        album_image = null;

    // Add
    const query = db.prepare("INSERT INTO albums (name, artist_id, img, year) VALUES (?, ?, ?, ?)");
    const result = query.run(name, artist_id, album_image, year);
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
    const query = db.prepare(`
                            INSERT INTO 
                                tracks 
                                (name, number, album_id, path,
                                format, duration, sample_rate) 
                            VALUES 
                                (?, ?, ?, ?,
                                ?, ?, ?)`);

    const result = query.run(name, number, album_id, path, metadata.format, metadata.duration, metadata.sample_rate);
    if (result.changes == 0)
        return false;

    return result.lastInsertRowid;
}

export function create_track_artist(track_id, artist_id) {
    const query = db.prepare("INSERT INTO track_artists (track_id, artist_id) VALUES (?, ?)");
    const result = query.run(track_id, artist_id);
    if (result.changes == 0)
        return false;

    return result.lastInsertRowid;
}

export function get_track_meta(id) {
    // Get normal metadata
    const query = db.prepare(`SELECT 
                    tracks.id as track_id, tracks.name as track, tracks.number as track_number,
                    albums.id as album_id, albums.name as album, albums.img IS NULL as album_cover,
                    artists.id as album_artist_id, artists.name as album_artist
                FROM tracks
                INNER JOIN albums ON tracks.album_id = albums.id
                INNER JOIN artists ON albums.artist_id = artists.id
                WHERE tracks.id = ?`);
    let result = query.get(id);
    if (!result)
        return false;

    // Find artist
    const query2 = db.prepare(`SELECT
                                track_artists.artist_id AS artist_id,
                                artists.name AS artist
                            FROM track_artists
                            INNER JOIN artists ON track_artists.artist_id = artists.id
                            WHERE track_id = ?`);
    const result2 = query2.all(id);
    if (!result2)
        return false;

    result.artists = result2;

    return result;
}

export function get_track_format(id) {
    // Get format data
    const query = db.prepare(`SELECT 
                                tracks.duration, tracks.sample_rate, tracks.format
                            FROM tracks
                            WHERE tracks.id = ?`);
    let result = query.get(id);
    if (!result)
        return false;

    return result;
}

export function get_all_track_meta() {
    let result = [];

    const query = db.prepare(`SELECT id FROM tracks`);
    const track_ids = query.all();

    for (let i = 0; i < track_ids.length; i++) {
        result.push(get_track_meta(track_ids[i].id));
    }
    
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
export function create_track_frame(track_id, format, index, data) {
    const query = db.prepare("INSERT INTO track_frames (track_id, format, frame_index, frame_data) VALUES (?, ?, ?, ?)");
    const result = query.run(track_id, format, index, data);
    if (result.changes == 0)
        return false;

    return result.lastInsertRowid;
}

export function create_track_frames(track_id, format, frames) {
    const query = db.prepare("INSERT INTO track_frames (track_id, format, frame_index, frame_data) VALUES (?, ?, ?, ?)");
    let tot_size = 0;

    const add_frames = db.transaction((frames) => {
        for (let i = 0; i < frames.length; i++) {
            query.run(track_id, format, i, frames[i].data);
            tot_size += frames[i].data.byteLength;
        }
    });

    add_frames(frames);

    return tot_size;
}

export function get_track_frame(track_id, format, index) {
    const query = db.prepare(`SELECT 
                                frame_data
                            FROM track_frames 
                            WHERE 
                                track_frames.track_id = ? 
                                AND track_frames.format = ? 
                                AND track_frames.frame_index = ?`);
    const result = query.get(track_id, format, index);
    if (!result)
        return false;

    return result;
}

export function get_track_frames(track_id, format, start_index, count) {
    const query = db.prepare(`SELECT 
                                frame_data
                            FROM track_frames 
                            WHERE 
                                track_frames.track_id = ? 
                                AND track_frames.format = ? 
                                AND track_frames.frame_index < ?
                            ORDER BY track_frames.frame_index DESC
                            LIMIT ?`);
    const result = query.all(track_id, format, start_index + count, count);
    if (!result)
        return false;

    console.log("Read new buffers.");
    return result;
}

// Search
export function create_search_entry(track_id, track, album, artists) {
    // Clean
    track = track || "";
    album = album || "";
    artists = artists || "";

    // Create artist data
    let artist = "";
    for (let i = 0; i < artists.length; i++) {
        artist += artists[i];
        if (i != artists.length - 1)
            artist += " ";
    }

    const query = db.prepare("INSERT INTO search_index (track_id, track, album, artist) VALUES (?, ?, ?, ?)");
    const result = query.run(track_id, track, album, artist);
    if (result.changes == 0)
        return false;

    return result.lastInsertRowid;
}

export function search(string, max_results) {
    // Process tokens
    const tokens = string.trim().toLowerCase().split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].length == 0)
            continue;

        const is_last = i === tokens.length - 1;

        if (is_last || tokens[i].length <= 5)
            tokens[i] = `${tokens[i]}*`;
    }

    // Combine, and make sure if statement works if it is empty
    let search_string = tokens.join(" ");
    if (tokens.length == 0)
        search_string = false;

    // Perform search
    let track_ids;
    if (search_string) { // Check there is anything
        // Search!
        const query = db.prepare(`SELECT track, album, artist, track_id, bm25(search_index, 10.0, 5.0, 2.0) AS rank
                                FROM search_index
                                WHERE search_index MATCH ?
                                ORDER BY rank
                                LIMIT ?`);
        track_ids = query.all(search_string, max_results);
    } else {
        // No search, so return whatever is first!
        const query = db.prepare(`SELECT id as track_id FROM tracks LIMIT ?`);
        track_ids = query.all(max_results);
    }

    if (!track_ids)
        return false;

    // Get tracks now
    let tracks = [];
    for (let i = 0; i < track_ids.length; i++) {
        tracks.push(get_track_meta(track_ids[i].track_id));
    }
    
    return tracks;
}

// Errors
export function log_error(type, file, description) {
    // Check correctness
    if (!type)
        type = "none";
    if (!description)
        description = "no description given";

    if (type.length > 64)
        return false;

    if (description.length > 1024)
        return false;

    // Do the thang
    const query = db.prepare(`INSERT INTO errors (type, file, description) VALUES (?, ?, ?)`);
    const result = query.run(type, file, description);
    if (!result.changes)
        return false;

    return result.lastInsertRowid;
}