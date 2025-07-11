// Find all music and puts it in the database. Also updates database when files change.

import * as fs from "fs/promises";
import path from "path";
import { parseFile as parse_metadata } from 'music-metadata';
import * as database from "./database.js";

export const Indexer = new class {
    //constructor(auto_update) {
    //    this.auto_update = auto_update;
    //}

    async scan(directory) {
        console.log("Indexing tracks...");

        // Find all .flac files here, and print out metadata.
        const files = (await fs.readdir(directory, { withFileTypes: true, recursive: true }))
                        .filter(dirent => dirent.isFile() && dirent.name.endsWith(".flac"));

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const file_path = path.join(file.parentPath, file.name);

            // Check that we have not parsed this before
            if (database.get_track_by_path(file_path))
                continue;

            // Get and parse data
            const data = await parse_metadata(file_path);
            console.log(`\nIndexing ${file.name}`);

            // Add artist if it does not exist yet
            let artist = data.common.artist || "Unknown";
            let artist_id = database.get_artist_name(artist);

            if (!artist_id)
                artist_id = database.create_artist(artist);

            // Add album if it does not exist yet
            let album = data.common.album || "Unknown";
            let album_id = database.get_album_name(album);

            if (!album_id)
                album_id = database.create_album(album, artist_id);

            // Find track name
            let track = data.common.title;
            if (!track)
                track = file.name || "Unknown"; // Deduce title instead

            let number = data.common.track.no || 1;
            
            // Add track if it does not exist
            database.create_track(track, number, album_id, file_path, {
                length: data.format.duration,
                bitrate: data.format.bitrate
            });

            console.log(`\nIndexed\n${track}\nfrom ${album}\nby ${artist}`);
        }
        
        console.log("\nTracks indexed.");
        return true;
    }
}

