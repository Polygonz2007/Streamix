
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
export function add_creator(name, type_id) {
    // Insert
    const insert = db.prepare("INSERT INTO creator(name, type_id) VALUES ($name, $type_id)");
    const result = insert.run({
        $name: name,
        $type_id: type_id
    });

    return result.lastInsertRowid;
}

export function get_creator_id(id) {
    // Insert
    const insert = db.prepare("SELECT * FROM creator WHERE creator.id = $id");
    const result = insert.get({
        $id: id
    });

    return result;
}

export function get_creator_name(name) {
    // Insert
    const insert = db.prepare("SELECT * FROM creator WHERE creator.name = $name");
    const result = insert.get({
        $name: name
    });

    return result;
}

// CREATOR_TYPE
export function add_creator_type(name) {
    // Insert
    const insert = db.prepare("INSERT INTO creator_type(name) VALUES ($name)");
    const result = insert.run({
        $name: name
    });

    return result.lastInsertRowid;
}

export function get_creator_type_name(name) {
    // Insert
    const insert = db.prepare("SELECT * FROM creator_type WHERE creator_type.name = $name");
    const result = insert.get({
        $name: name
    });

    return result;
}

// CREATOR_IMAGE
export function add_creator_image(creator_id, level, image) {
    // Insert
    const insert = db.prepare("INSERT INTO creator_image(creator_id, level, image) VALUES ($creator_id, $level, $image)");
    const result = insert.run({ 
        $creator_id: creator_id,
        $level: level,
        $image: image
     });

    return result.lastInsertRowid;
}

// COLLECTION
export function add_collection(name, creator_id, type_id) {
    // Insert
    const insert = db.prepare("INSERT INTO collection(name, creator_id, type_id) VALUES ($name, $creator_id, $type_id)");
    const result = insert.run({
        $name: name,
        $creator_id: creator_id,
        $type_id: type_id
    });

    return result.lastInsertRowid;
}

export function get_collection_id(id) {
    // Insert
    const insert = db.prepare("SELECT * FROM collection WHERE collection.id = $id");
    const result = insert.get({
        $id: id
    });

    return result;
}

export function get_collection_name(name, creator_id) {
    // Insert
    const insert = db.prepare("SELECT * FROM collection WHERE collection.name = $name AND collection.creator_id = $creator_id");
    const result = insert.get({
        $name: name,
        $creator_id: creator_id
    });

    return result;
}

// COLECTION_TYPE
export function add_collection_type(name) {
    // Insert
    const insert = db.prepare("INSERT INTO collection_type(name) VALUES ($name)");
    const result = insert.run({
        $name: name
    });

    return result.lastInsertRowid;
}

export function get_collection_type_name(name) {
    // Insert
    const insert = db.prepare("SELECT * FROM collection_type WHERE collection_type.name = $name");
    const result = insert.get({
        $name: name
    });

    return result;
}

// GENRE
export function add_genre(name) {
    // Insert
    const insert = db.prepare("INSERT INTO genre(name) VALUES ($name)");
    const result = insert.run({
        $name: name
    });

    return result.lastInsertRowid;
}

export function get_genre_name(name) {
    // Insert
    const insert = db.prepare("SELECT * FROM genre WHERE genre.name = $name");
    const result = insert.get({
        $name: name
    });

    return result;
}

// TRACK
export function add_track(name, number, disc, duration, released) {
    // Insert
    const insert = db.prepare("INSERT INTO track(name, number, disc, duration, released) VALUES ($name, $number, $disc, $duration, $released)");
    const result = insert.run({
        $name: name,
        $number: number,
        $disc: disc,
        $duration: duration,
        $released: released
    });

    return result.lastInsertRowid;
}

// TRACK_GENRE
export function track_genres(track_id, genre_ids) {
    // Get or insert
    const select = db.prepare("SELECT * FROM track_genre WHERE track_id = $track_id AND genre_id = $genre_id");
    const insert = db.prepare("INSERT INTO track_genre(track_id, genre_id) VALUES ($track_id, $genre_id)");

    const result = db.transaction((track_id, genre_ids) => {
        let ids = [];
        for (let i = 0; i < genre_ids.length; i++) {
            const data = {
                $track_id: track_id,
                $genre_id: genre_ids[i]
            };

            // Try to get first
            const track_genre = select.get(data);
            if (track_genre) {
                ids.push(track_genre.id);
                continue;
            }

            // Else, add it to database
            ids.push(insert.run(data).lastInsertRowid);
        }

        return ids;
    })(track_id, genre_ids);

    return result;
}


// TRACK_CREATOR
export function track_creators(track_id, creator_ids) {
    // Get or insert
    const select = db.prepare("SELECT * FROM track_creator WHERE track_id = $track_id AND creator_id = $creator_id");
    const insert = db.prepare("INSERT INTO track_creator(track_id, creator_id) VALUES ($track_id, $creator_id)");

    const result = db.transaction((track_id, creator_ids) => {
        let ids = [];
        for (let i = 0; i < creator_ids.length; i++) {
            const data = {
                $track_id: track_id,
                $creator_id: creator_ids[i]
            };

            // Try to get first
            const track_creator = select.get(data);
            if (track_creator) {
                ids.push(track_creator.id);
                continue;
            }

            // Else, add it to database
            ids.push(insert.run(data).lastInsertRowid);
        }

        return ids;
    })(track_id, creator_ids);

    return result;
}

// TRACK_COLLECTION
export function add_track_collection(track_id, collection_id, position) {
    // TODO: Add checks so multiple tracks cant have same position

    // Insert
    const insert = db.prepare("INSERT INTO track_collection(track_id, collection_id, position) VALUES ($track_id, $collection_id, $position)");
    const result = insert.run({
        $track_id: track_id, 
        $collection_id: collection_id,
        $position: position
    });

    return result.lastInsertRowid;
}

// TRACK_FORMAT


// TRACK_FRAME