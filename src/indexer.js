// Find all music and puts it in the database. Also updates database when files change.

import * as fs from "fs/promises";
import path from "path";
import { parseFile as parse_metadata } from 'music-metadata';
import * as database from "./database.js";
import codec_parser from "codec-parser";
import { buffer } from "stream/consumers";

export const Indexer = new class {
    //constructor(auto_update) {
    //    this.auto_update = auto_update;
    //}

    async scan(directory) {
        console.log("Indexing tracks...");
        const block_size = process.env.block_size;

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

            // Add artist if it does not exist yet
            let artist = data.common.artist || "Unknown";
            let artist_id = database.get_artist_name(artist);

            if (!artist_id)
                artist_id = database.create_artist(artist);

            // Add album if it does not exist yet
            let album = data.common.album || "Unknown";
            let album_id = database.get_album_name(album);

            if (!album_id) {
                let album_image = null;
                if (data.common.picture)
                    album_image = data.common.picture[0].data;

                album_id = database.create_album(album, artist_id, album_image);
            }

            // Find track name
            let track = data.common.title;
            if (!track)
                track = file.name || "Unknown"; // Deduce title instead

            let number = data.common.track.no || 1;
            
            // Add track if it does not exist
            const track_id = database.create_track(track, number, album_id, file_path, {
                duration: data.format.duration,
                bitrate: data.format.bitrate,
                sample_rate: data.format.sampleRate
            });

            // Then add track data.
            const parser = new codec_parser("audio/flac");
            const file_data = await fs.readFile(file_path);
            const frames = parser.parseAll(file_data);
            const num_blocks = Math.ceil(frames.length / process.env.block_size);
            let tot_size = 0;
            let tot_blocks = 0;

            const format = 0;
            for (let index = 0; index < num_blocks; index++) {
                // Gather frames into block
                let block_frames = [];
                let block_frames_size = 0;

                // Get all the data
                let num_frames = 0;
                const frame_offset = index * block_size;
                for (let fi = 0; fi < block_size; fi++) {
                    const frame_index = frame_offset + fi;
                    if (!frames[frame_index])
                        continue;

                    const frame_data = frames[frame_index].data;
                    block_frames.push(frame_data);
                    block_frames_size += frame_data.length;
                    num_frames++;
                }

                // Create buffer, write frame lengths
                const block_frame_lengths_size = num_frames * 2; // 16 bits
                const buffer_size = block_frame_lengths_size + block_frames_size;
                const block_data = Buffer.alloc(buffer_size);
                for (let i = 0; i < num_frames; i++) {
                    const length = block_frames[i].length;
                    block_data.writeUint16LE(length, i * 2);
                }

                // Write data
                let offset = block_frame_lengths_size;
                for (let i = 0; i < block_frames.length; i++) {
                    Buffer.from(block_frames[i]).copy(block_data, offset);
                    offset += block_frames[i].length;
                }

                // Add to database
                const result = database.create_track_data(track_id, format, index, num_frames, buffer_size, block_data);
                if (!result)
                    console.warn(`Error indexing block data for track "${track}" [ID ${track_id}] at index #${index}.`);

                tot_size += block_frames_size;
                tot_blocks += block_frames.length;
            }

            console.log(`Indexed track #${track_id} ["${track}"]\nTotal blocks: ${tot_blocks}\nSize (mb): ${Math.ceil(tot_size / 100000) / 10}\n`);
        }
        
        console.log("\nTracks indexed.");
        return true;
    }
}

