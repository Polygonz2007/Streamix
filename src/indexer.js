// Find all music and puts it in the database. Also updates database when files change.

import * as fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { parseFile as parse_metadata } from 'music-metadata';
import * as database from "./database.js";
import codec_parser, { duration } from "codec-parser";

const Indexer = new class {
    //constructor(auto_update) {
    //    this.auto_update = auto_update;
    //}

    async scan(directory) {
        console.log(`Indexing tracks from "${directory}"...`);

        // Check if directory exists
        if (!existsSync(directory)) {
            console.log("Indexing failed. Directory is not available.");
            return false;
        }

        // Find all .flac files here, and print out metadata.
        const files = (await fs.readdir(directory, { withFileTypes: true, recursive: true }))
                        .filter(dirent => dirent.isFile() && dirent.name.endsWith(".flac"));

        for (let i = 0; i < files.length; i++) {
            const time_start = performance.now();
            
            const file = files[i];
            const file_path = path.join(file.parentPath, file.name);

            // Check that we have not parsed this before
            if (database.get_track_by_path(file_path))
                continue;

            // Get and parse metadata
            const data = await parse_metadata(file_path);

            // Get and parse audio data
            const parser = new codec_parser("audio/flac");
            const file_data = await fs.readFile(file_path);
            const frames = parser.parseAll(file_data);
            const num_frames = frames.length;

            // Add artist(s) if it does not exist yet
            let artists = data.common.artists || false;
            let artist_ids = [];
            let album_artist = data.common.albumartist || artists[0] || false;

            if (!artists) {
                database.log_error("artist", file_path, "no artists found");
                continue;
            }

            // Create album artist
            let album_artist_id = database.get_artist_name(album_artist);

            if (!album_artist_id)
                album_artist_id = database.create_artist(album_artist);

            // Create other artists
            for (let i = 0; i < artists.length; i++) {
                const artist = artists[i];
                let artist_id = database.get_artist_name(artist);

                if (!artist_id)
                    artist_ids[i] = database.create_artist(artist);
                else
                    artist_ids[i] = artist_id;
            }

            // Add album if it does not exist yet
            let album = data.common.album || false;
            if (!album) {
                database.log_error("album", file_path, "no album found");
                continue;
            }

            let album_id = database.get_album_name(album);

            if (!album_id) {
                let album_image = null;

                // Check folder for album cover (usually higher quality)
                const cover_path = path.join(file.parentPath, "cover.jpg");
                if (existsSync(cover_path))
                    album_image = await fs.readFile(cover_path);

                // Check file for album cover, if there is none in folder
                if (!album_image && data.common.picture)
                    album_image = data.common.picture[0].data;

                // Get year
                const album_year = data.common.year;

                album_id = database.create_album(album, album_artist_id, album_image, album_year);
            }

            // Find track name
            let track = data.common.title;
            if (!track) {
                database.log_error("track", file_path, "no track title found");
                continue;
            }

            let number = data.common.track.no || 0;
            if (!number) {
                database.log_error("track", file_path, "no track number found");
            }
            
            // Add track if it does not exist
            const track_id = database.create_track(track, number, album_id, file_path, {
                duration: data.format.duration,
                bitrate: data.format.bitrate,
                sample_rate: data.format.sampleRate,
                num_frames: num_frames
            });

            // Add track artists
            for (let i = 0; i < artists.length; i++) {
                const track_artist = database.create_track_artist(track_id, artist_ids[i]);
                if (!track_artist)
                    database.log_error("track_artist", file_path, `failed to add track artist "${artists[i]}"`);
            }


            // Then add track data.
            let tot_size = 0;
            const format = 0;

            // TODO: START TRANSACTION (speed up adding frame data)
            for (let index = 0; index < num_frames; index++) {
                // Get frame data
                const frame_data = frames[index].data;
                const frame_duration = frames[index].duration;

                // Add to database
                const result = database.create_track_frame(track_id, format, index, frame_duration, frame_data);
                if (!result)
                    console.warn(`Error indexing frame data for track "${track}" [ID ${track_id}] at index #${index}.`);

                tot_size += frame_data.byteLength;
            }
            // END TRANSACTION

            // Add track to search index
            let keywords = "";
    
            keywords += `${track} ${number} ${album}`;
            for (let i = 0; i < artists.length; i++) {
                keywords += ` ${artists[i]}`;
            }

            database.create_search_entry(track_id, track, album, artists);

            const time_end = performance.now();
            console.log(`Indexed track #${track_id} ["${track}"]\nFrames: ${frames.length} [${data.format.duration.toFixed(0)}s]\nSize: ${Math.ceil(tot_size / 1_000_000).toFixed(2)} MB\nTook ${Math.floor(time_end - time_start)}ms to complete.\n`);
        }
        
        console.log(`\nTracks for "${directory}" indexed.`);
        return true;
    }

    async get_metadata(file_path) {
        if (existsSync(file_path))
            return await parse_metadata(file_path);
        else
            return false;
    }
}

export default Indexer;