
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
    creator = { id: database.add_creator(name, creator_type.id, generated), name: name, new: true };

    return creator;
}

// Returns ID of collection, either new or pre-existing
export function collection(name, type, creator, image, generated) {
    // Check existance
    let collection = database.get_collection_name(name, creator.id);
    if (collection)
        return collection;

    // If not available, validate creator, create type, then creator
    // Validate creator
    if (!database.get_creator_id(creator.id))
        return false;

    // Add / get type
    let collection_type = database.get_collection_type_name(type);
    if (!collection_type)
        collection_type = { id: database.add_collection_type(type) };

    // Add collection
    collection = { id: database.add_collection(name, creator.id, collection_type.id, image, generated), name: name, has_image: image !== undefined, new: true };

    return collection;
}

// Returns ID of genre, either new or pre-existing
export function genre(name) {
    // Get genre first
    let genre = database.get_genre_name(name);
    if (genre)
        return genre;

    // Add genre
    genre = { id: database.add_genre(name), name: name };

    return genre;
}

export function track(name, number, disc, duration, released, collection, path) {
    // Check existance
    let track = database.get_track_name(name, collection.id);
    if (track)
        return track;

    // Validate collection
    if (!database.get_collection_id(collection.id))
        return false;

    // Add track
    track = { id: database.add_track(name, number, disc, duration, released, path), name: name, new: true };

    return track;
}

export function item(track, collection, position) {
    // Check existance
    let item = database.get_item_track_collection(track.id, collection.id);
    if (item)
        return item;

    // Add item
    item = { id: database.add_item(track.id, collection.id, position) };

    return item;
}

export function track_creators(track, creators) {
    // Add / get creator-s
    for (let i = 0; i < creators.length; i++) {
        creators[i] = creator(creators[i], "artist", true); // Default type artist. If creator already exists it is not modified.
    }

    // Add track_creator-s
    database.track_creators(track.id, creators);
    return creators;
}

export function track_genres(track, genres) {
    // Add / get genre-s
    for (let i = 0; i < genres.length; i++) {
        genres[i] = genre(genres[i]); // If genre already exists it is not modified.
    }

    // Add track_genres
    database.track_genres(track.id, genres);
    return genres;
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

export function search_index(item, track, collection, creators, genres) {
    // Explode values
    let indexes = [];
    for (let i = 0; i < creators.length; i++) {
        for (let j = 0; j < genres.length; j++) {
            indexes.push({
                item: item,
                track: track,
                collection: collection,
                creator: creators[i],
                genre: genres[j]
            });
        }
    }

    // Do for each comination
    indexes.forEach((index) => {
        // Try to get with ids
        let search_index = database.get_search_index(index.item.id, index.collection.id, index.creator.id, index.genre.id);
        if (search_index)
            return;

        // Add search index
        database.add_search_index(index.item, index.track, index.collection, index.creator, index.genre);
    })

    return true;
}

// If one of these has a "new" property, it was made by the current call. Else it wasnt. Can get id with .id on any of these

export function get_meta(item_id) {
    let result = {};

    // Get track collection
    const { track_id, collection_id } = database.get_item_id(item_id);

    // Get track
    result.track = database.get_track_id(track_id);
    if (!result.track)
        return false;

    // Get collection
    result.collection = database.get_collection_id(collection_id);
    if (!result.collection)
        return false;

    // Get creator of collection (generated)
    result.collection_creator = database.get_creator_id(result.collection.creator_id);
    if (!result.collection_creator)
        return false;

    // Get track creators
    result.creators = database.get_track_creators(track_id);
    if (!result.creators)
        return false;

    // Get track genres
    result.genres = database.get_track_genres(track_id);
    if (!result.genres)
        return false;

    // Return
    return result;
}

export function search(string, page, page_size) {
    let result = {};

    // Format string query
    const tokens = string.split(" ");
    if (tokens[tokens.length - 1].length > 0)
        string += "*";

    // Search each type and put into results
    const items = database.search_items(string, page, page_size);
    if (items) {
        let full_items = [];
        items.forEach((item) => {
            let track = database.get_track_item(item.id);
            full_items.push({
                id: item.id,
                track: track
            });
        });

        result.items = full_items;
    }

    const collections = database.search_collections(string, page, page_size);
    if (collections) {
        let full_collections = [];
        collections.forEach((collection) => {
            full_collections.push(database.get_collection_id(collection.id));
        });
        
        result.collections = full_collections;
    }

    const creators = database.search_creators(string, page, page_size);
    if (creators) {
        let full_creators = [];
        creators.forEach((creator) => {
            full_creators.push(database.get_creator_id(creator.id));
        });
        
        result.creators = full_creators;
    }

    return result;
}