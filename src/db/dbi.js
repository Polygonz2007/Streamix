
// High level interface for the database

import * as database from "./database.js";

// Returns ID of creator, either new or pre-existing
export function creator(name, type, generated) {
    // Check existance
    let creator = database.get_creator_name(name);
    if (creator)
        return creator;

    // If not available, create type, then creator
    // Add / get type
    let creator_type = database.get_creator_type_name(type);
    if (!creator_type)
        creator_type = { id: database.add_creator_type(type) };

    // Add creator
    creator = { id: database.add_creator(name, creator_type.id, generated), new: true };

    return creator;
}

// Returns ID of collection, either new or pre-existing
export function collection(name, type, creator_id, generated) {
    // Check existance
    let collection = database.get_collection_name(name, creator_id);
    if (collection)
        return collection;

    // If not available, validate creator, create type, then creator
    // Validate creator
    if (!database.get_creator_id(creator_id).id)
        return false;

    // Add / get type
    let collection_type = database.get_collection_type_name(type);
    if (!collection_type)
        collection_type = { id: database.add_collection_type(type) };

    // Add collection
    collection = { id: database.add_collection(name, creator_id, collection_type.id, generated), new: true };

    return collection;
}

// Returns ID of genre, either new or pre-existing
export function genre(name) {
    // Get genre first
    let genre = database.get_genre_name(name);
    if (genre)
        return genre;

    // Add genre
    genre = { id: database.add_genre(name) };

    return genre;
}

export function track(name, number, disc, duration, released, collection_id, creators, genres, path) {
    // Check existance
    let track = database.get_track_name(name, collection_id);
    if (track)
        return track;

    // Validate collection
    if (!database.get_collection_id(collection_id))
        return false;

    // Add track
    track = { id: database.add_track(name, number, disc, duration, released, path), new: true };

    // Add track_collection
    database.add_track_collection(track.id, collection_id, number);

    // Add / get creator-s
    let creator_ids = [];
    for (let i = 0; i < creators.length; i++) {
        creator_ids.push(creator(creators[i], "artist", true).id); // Default type artist. If creator already exists it is not modified.
    }

    // Add track_creator-s
    database.track_creators(track.id, creator_ids);

    // Add / get genre-s
    let genre_ids = [];
    for (let i = 0; i < genres.length; i++) {
        genre_ids.push(genre(genres[i]).id); // Default type artist. If cgenre already exists it is not modified.
    }

    // Add track_genres
    database.track_genres(track.id, genre_ids);

    return track;
}

export function track_format(track_id, format_id, ready, overwrite) {
    // Check existance
    let track_format = database.get_track_format(track_id, format_id);
    if (track_format && ready == null)
        return track_format;

    if (track_format && overwrite) {
        // If exists, update with ready
        track_format = database.update_track_format_ready(track_id, format_id, ready);
    } else if (!track_format) {
        // If not exists, create with ready
        track_format = database.add_track_format(track_id, format_id, ready);
    }

    return track_format;
}

// If one of these has a "new" property, it was made by the current call. Else it wasnt. Can get id with .id on any of these
