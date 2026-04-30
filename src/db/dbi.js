
// High level interface for the database

import * as database from "./database.js";

// Returns ID of creator, either new or pre-existing
export function creator(name, type, generated) {
    // Get creator first
    let creator = database.get_creator_name(name);
    if (creator)
        return creator.id;

    // If not available, create type, then creator
    // Add / get type
    let creator_type = database.get_creator_type_name(type);
    if (!creator_type)
        creator_type = { id: database.add_creator_type(type) };

    // Add creator
    creator = { id: database.add_creator(name, creator_type.id, generated) };

    return creator.id;
}

// Returns ID of collection, either new or pre-existing
export function collection(name, type, creator_id, generated) {
    // Get collection first
    let collection = database.get_collection_name(name, creator_id);
    if (collection)
        return collection.id;

    // If not available, validate creator, create type, then creator
    // Validate creator
    if (!database.get_creator_id(creator_id).id)
        return false;

    // Add / get type
    let collection_type = database.get_collection_type_name(type);
    if (!collection_type)
        collection_type = { id: database.add_collection_type(type) };

    // Add collection
    collection = { id: database.add_collection(name, creator_id, collection_type.id, generated) };

    return collection.id;
}

// Returns ID of genre, either new or pre-existing
export function genre(name) {
    // Get genre first
    let genre = database.get_genre_name(name);
    if (genre)
        return genre.id;

    // Add genre
    genre = { id: database.add_genre(name) };

    return genre.id;
}

export function track(name, number, disc, duration, released, collection_id, creators, genres) {
    // Validate collection
    if (!database.get_collection_id(collection_id))
        return false;

    // Add track
    const track_id = database.add_track(name, number, disc, duration, released);

    // Add track_collection
    database.add_track_collection(track_id, collection_id, number);

    // Add / get creator-s
    let creator_ids = [];
    for (let i = 0; i < creators.length; i++) {
        creator_ids.push(creator(creators[i], "artist", true)); // Default type artist. If creator already exists it is not modified.
    }

    // Add track_creator-s
    database.track_creators(track_id, creator_ids);

    // Add / get genre-s
    let genre_ids = [];
    for (let i = 0; i < genres.length; i++) {
        genre_ids.push(genre(genres[i])); // Default type artist. If cgenre already exists it is not modified.
    }

    // Add track_genres
    database.track_genres(track_id, genre_ids);

    return track_id;
}
