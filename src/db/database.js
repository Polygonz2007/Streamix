
// Handles database interaction on a low level.

import Utils from "../util.js";
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
    
        Utils.overwrite_line("Database created.\n");
    }

    if (!db) {
        db = new Database(process.env.db_path);
        db.run("PRAGMA journal_mode = WAL;");
        console.log("Database loaded.");
    }
    
    return true;
}



// CREATOR
export function add_creator(name, type_id, generated) {
    // Insert
    const insert = db.prepare("INSERT INTO creator(name, type_id, generated) VALUES ($name, $type_id, $generated)");
    const result = insert.run({
        $name: name,
        $type_id: type_id,
        $generated: generated
    });

    return result.lastInsertRowid;
}

export function get_creator_id(id) {
    // Insert
    const select = db.prepare("SELECT * FROM creator WHERE creator.id = $id");
    const result = select.get({
        $id: id
    });

    return result;
}

export function get_creator_name(name) {
    // Insert
    const select = db.prepare("SELECT * FROM creator WHERE creator.name = $name");
    const result = select.get({
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
    const select = db.prepare("SELECT * FROM creator_type WHERE creator_type.name = $name");
    const result = select.get({
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
export function add_collection(name, creator_id, type_id, image, generated) {
    // Insert
    const insert = db.prepare("INSERT INTO collection(name, creator_id, type_id, image, generated) VALUES ($name, $creator_id, $type_id, $image, $generated)");
    const result = insert.run({
        $name: name,
        $creator_id: creator_id,
        $type_id: type_id,
        $image: image,
        $generated: generated
    });

    return result.lastInsertRowid;
}

export function get_collection_id(id) {
    // Select
    const select = db.prepare("SELECT id, name, creator_id, type_id, collection.image IS NOT NULL as has_image, generated FROM collection WHERE collection.id = $id");
    const result = select.get({
        $id: id
    });

    return result;
}

export function get_collection_name(name, creator_id) {
    // Select
    const select = db.prepare("SELECT id, name, creator_id, type_id, collection.image IS NOT NULL as has_image, generated FROM collection WHERE collection.name = $name AND collection.creator_id = $creator_id");
    const result = select.get({
        $name: name,
        $creator_id: creator_id
    });

    return result;
}

export function get_collection_image(collection_id) {
    // Select
    const select = db.prepare("SELECT image FROM collection WHERE collection.id = $collection_id");
    const result = select.get({
        $collection_id: collection_id
    });

    return result;
}

export function update_collection_image(collection_id, image) {
    // Update
    const update = db.prepare("UPDATE collection SET image = $image WHERE collection.id = $collection_id");
    const result = update.run({
        $collection_id: collection_id,
        $image: image
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
    const select = db.prepare("SELECT * FROM collection_type WHERE collection_type.name = $name");
    const result = select.get({
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
    const select = db.prepare("SELECT * FROM genre WHERE genre.name = $name");
    const result = select.get({
        $name: name
    });

    return result;
}

// TRACK
export function add_track(name, number, disc, duration, released, path) {
    // Insert
    const insert = db.prepare("INSERT INTO track(name, number, disc, duration, released, path) VALUES ($name, $number, $disc, $duration, $released, $path)");
    const result = insert.run({
        $name: name,
        $number: number,
        $disc: disc,
        $duration: duration,
        $released: released,
        $path: path
    });

    return result.lastInsertRowid;
}

export function get_track_name(name, collection_id) {
    // Get
    const select = db.prepare(`SELECT * FROM track
                               INNER JOIN item ON track.id = item.track_id
                               WHERE track.name = $name AND item.collection_id = $collection_id`);
    
    const result = select.get({
        $name: name,
        $collection_id: collection_id
    });

    return result;
}

export function get_track_id(id) {
    // Get
    const select = db.prepare(`SELECT * FROM track WHERE id = $id`);
    const result = select.get({ $id: id });

    return result;
}

export function get_track_item(id) {
    // Get
    const select = db.prepare(`SELECT track.* FROM track INNER JOIN item ON item.track_id = track.id WHERE item.id = $id`);
    const result = select.get({ $id: id });

    return result;
}


// TRACK_GENRE
export function track_genres(track_id, genres) {
    // Get or insert
    const select = db.prepare("SELECT * FROM track_genre WHERE track_id = $track_id AND genre_id = $genre_id");
    const insert = db.prepare("INSERT INTO track_genre(track_id, genre_id) VALUES ($track_id, $genre_id)");

    const result = db.transaction((track_id, genres) => {
        let ids = [];
        for (let i = 0; i < genres.length; i++) {
            const data = {
                $track_id: track_id,
                $genre_id: genres[i].id
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
    })(track_id, genres);

    return result;
}

export function get_track_genres(track_id) {
    // Get
    const select = db.prepare(`SELECT genre.* FROM track_genre
                               INNER JOIN genre ON track_genre.genre_id = genre.id
                               WHERE track_id = $track_id`);
    const result = select.all({ $track_id: track_id });
    
    return result;
}

// TRACK_CREATOR
export function track_creators(track_id, creators) {
    // Get or insert
    const select = db.prepare("SELECT * FROM track_creator WHERE track_id = $track_id AND creator_id = $creator_id");
    const insert = db.prepare("INSERT INTO track_creator(track_id, creator_id) VALUES ($track_id, $creator_id)");

    const result = db.transaction((track_id, creators) => {
        let ids = [];
        for (let i = 0; i < creators.length; i++) {
            const data = {
                $track_id: track_id,
                $creator_id: creators[i].id
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
    })(track_id, creators);

    return result;
}

export function get_track_creators(track_id) {
    // Get
    const select = db.prepare(`SELECT creator.* FROM track_creator
                               INNER JOIN creator ON track_creator.creator_id = creator.id
                               WHERE track_id = $track_id`);
    const result = select.all({ $track_id: track_id });
    
    return result;
}

// ITEM
export function add_item(track_id, collection_id, position) {
    // TODO: Add checks so multiple tracks cant have same position

    // Insert
    const insert = db.prepare("INSERT INTO item(track_id, collection_id, position) VALUES ($track_id, $collection_id, $position)");
    const result = insert.run({
        $track_id: track_id, 
        $collection_id: collection_id,
        $position: position
    });

    return result.lastInsertRowid;
}

export function get_item_id(item_id) {
    // Get
    const select = db.prepare(`SELECT * FROM item WHERE id = $item_id`);
    const result = select.get({ $item_id: item_id });
    
    return result;
}

export function get_item_track_collection(track_id, collection_id) {
    // Get
    const select = db.prepare(`SELECT * FROM item WHERE track_id = $track_id AND collection_id = $collection_id`);
    const result = select.get({
        $track_id: track_id,
        $collection_id: collection_id
    });
    
    return result;
}

// TRACK_FORMAT
export function add_track_format(track_id, format_id, ready) {
    // Insert
    const insert = db.prepare("INSERT INTO track_format(track_id, format_id, ready) VALUES ($track_id, $format_id, $ready)");
    const result = insert.run({
        $track_id: track_id, 
        $format_id: format_id,
        $ready: ready
    });

    return result.lastInsertRowid;
}

export function update_track_format_ready(track_id, format_id, ready) {
    // Update
    const update = db.prepare("UPDATE track_format SET ready = $ready WHERE track_id = $track_id AND format_id = $format_id");
    const result = update.run({
        $track_id: track_id, 
        $format_id: format_id,
        $ready: ready
    });

    return true;
}

export function get_track_format(track_id, format_id) {
    // Insert
    const select = db.prepare(`SELECT * FROM track_format WHERE track_id = $track_id AND format_id = $format_id`);
    const result = select.get({
        $track_id: track_id,
        $format_id: format_id
    });

    return result;
}

export function get_track_format_by_ready(ready) {
    // Get
    const select = db.prepare(`SELECT * FROM track_format WHERE track_format.ready = $ready`);
    const result = select.all({ $ready: ready });

    return result;
}

// Returns the highest format level track has
export function get_track_format_by_level(track_id, level) {
    // Get
    const select = db.prepare(`SELECT format.* FROM track
                               INNER JOIN track_format ON track_format.track_id = track.id
                               INNER JOIN format ON track_format.format_id = format.id
                               WHERE track.id = $track_id
                               AND format.level <= $level
                               AND track_format.ready = 1
                               ORDER BY level DESC
                               LIMIT 1`);
    const result = select.get({
        $track_id: track_id,
        $level: level
    });

    if (result)
        return result;

    // If level too low, pick the lowest format
    const select_lowest = db.prepare(`SELECT format.* FROM track
                            INNER JOIN track_format ON track_format.track_id = track.id
                            INNER JOIN format ON track_format.format_id = format.id
                            WHERE track.id = $track_id
                            AND track_format.ready = 1
                            ORDER BY level ASC
                            LIMIT 1`);
    const result_lowest = select_lowest.get({
        $track_id: track_id,
        $level: level
    });

    if (result_lowest)
        return result_lowest;

    // If track has no formats, return false
    return false;
}

// TRACK_FRAME
export function add_track_frames(track_id, format_id, frames) {
    if (frames.length == 0)
        return false;

    // Insert
    const insert = db.prepare("INSERT INTO track_frame(track_id, format_id, frame_index, frame_size, frame_data) VALUES ($track_id, $format_id, $frame_index, $frame_size, $frame_data)");
    const result = db.transaction((track_id, format_id, frames) => {
        let frame_num = 0;
        for (let i = 0; i < frames.length; i++) {
            const data = {
                $track_id: track_id,
                $format_id: format_id,
                $frame_index: i,
                $frame_size: frames[i].data.byteLength,
                $frame_data: frames[i].data
            };

            insert.run(data);
            frame_num++;
        }

        return frame_num;
    })(track_id, format_id, frames);

    return result;
}

export function get_track_frames(track_id, format_id, start_index, num) {
    // Get
    const select = db.prepare("SELECT * FROM track_frame WHERE track_id = $track_id AND format_id = $format_id AND frame_index >= $start_index LIMIT $num");
    const result = select.all({
        $track_id: track_id,
        $format_id: format_id,
        $start_index: start_index,
        $num: num
    });

    return result;
}

// FORMAT
export function get_formats() {
    // Get
    const select = db.prepare("SELECT * FROM format ORDER BY format.level ASC");
    const result = select.all();

    return result;
}

// SEARCH
export function add_search_index(item, track, collection, creator, genre) {
    // Clean values
    track.name = track.name.replace(/[^0-9a-z ]/gi, '').toLowerCase();
    collection.name = collection.name.replace(/[^0-9a-z ]/gi, '').toLowerCase();
    creator.name = creator.name.replace(/[^0-9a-z ]/gi, '').toLowerCase();
    genre.name = genre.name.replace(/[^0-9a-z ]/gi, '').toLowerCase();

    // Insert
    const insert =  db.prepare(`INSERT INTO search_index(
                                    item, collection, creator, genre, 
                                    item_id, collection_id, creator_id, genre_id
                                ) VALUES (
                                    $item, $collection, $creator, $genre, 
                                    $item_id, $collection_id, $creator_id, $genre_id
                                )`);
    const result = insert.run({
        $item: track.name,
        $collection: collection.name,
        $creator: creator.name,
        $genre: genre.name,

        $item_id: item.id,
        $collection_id: collection.id,
        $creator_id: creator.id,
        $genre_id: genre.id
    });

    return { id: result.lastInsertRowid };
}

export function get_search_index(item_id, collection_id, creator_id, genre_id) {
    // Insert
    const select =  db.prepare(`SELECT * FROM search_index
                                WHERE item_id = $item_id
                                AND collection_id = $collection_id
                                AND creator_id = $creator_id
                                AND genre_id = $genre_id`);
    const result = select.get({
        $item_id: item_id,
        $collection_id: collection_id,
        $creator_id: creator_id,
        $genre_id: genre_id
    });

    if (!result)
        return false;

    return result;
}

export function search_items(string, page, page_size) {
    // Get
    const select =  db.prepare(`SELECT item_id as id, SUM(rank) as score FROM (
                                SELECT item, collection, creator, genre, bm25(search_index, 10.0, 4.0, 2.0, 1.0) AS rank, item_id
                                FROM search_index
                                WHERE search_index MATCH $string
                                ORDER BY rank)
                                GROUP BY item_id
                                ORDER BY score ASC
                                LIMIT $size
                                OFFSET $offset`);
    const result = select.all({
        $string: string,
        $size: page_size,
        $offset: page * page_size
    });

    if (!result)
        return false;

    return result;
}

export function search_collections(string, page, page_size) {
    // Get
    const select =  db.prepare(`SELECT collection_id as id, SUM(rank) as score FROM (
                                SELECT item, collection, creator, genre, bm25(search_index, 2.0, 10.0, 4.0, 1.0) AS rank, collection_id
                                FROM search_index
                                WHERE search_index MATCH $string
                                ORDER BY rank)
                                GROUP BY collection_id
                                ORDER BY score ASC
                                LIMIT $size
                                OFFSET $offset`);
    const result = select.all({
        $string: string,
        $size: page_size,
        $offset: page * page_size
    });

    if (!result)
        return false;

    return result;
}

export function search_creators(string, page, page_size) {
    // Get
    const select =  db.prepare(`SELECT creator_id as id, SUM(rank) as score FROM (
                                SELECT item, collection, creator, genre, bm25(search_index, 2.0, 4.0, 10.0, 1.0) AS rank, creator_id
                                FROM search_index
                                WHERE search_index MATCH $string
                                ORDER BY rank)
                                GROUP BY creator_id
                                ORDER BY score ASC
                                LIMIT $size
                                OFFSET $offset`);
    const result = select.all({
        $string: string,
        $size: page_size,
        $offset: page * page_size
    });

    if (!result)
        return false;

    return result;
}

// Can add search for genres later