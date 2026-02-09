// Find all music and puts it in the database. Also updates database when files change.

import * as fs from "fs/promises";
import { existsSync, read } from "fs";
import path from "path";
import { parseFile as parse_metadata } from 'music-metadata';
import * as database from "./database.js";
import codec_parser, { duration } from "codec-parser";
import { spawn } from "child_process";
import { Readable } from "stream";

import Utils from "./util.js";

const formats = [
    "None",
    "Max [Flac]",
    "CD [Flac]",
    "High [Opus, 256 kbps]",
    "Medium [Opus, 128 kbps]",
    "Low [Opus, 64 kbps]",
    "Trash [Opus, 24 kbps]"
]

const Indexer = new class {
    constructor(auto_update) {
        this.auto_update = auto_update;
        this.max_threads = 8; // Max threads to use at once while indexing data

        // Indexing
        this.jobs = new Map(); // Job index -> Track id and format
        this.files = new Map(); // Track id -> path
        this.file_data = new Map(); // Track id -> Uint8Buf
        this.job_index = 0; // Increments
        this.threads = 0;
    }

    async check_jobs() {
        if (this.jobs.size == 0)
            return; // Nothing more to do

        if (this.threads >= this.max_threads)
            return; // No more threads available. Just wait until next thread is done

        // Pick a job
        const job = this.jobs.entries().next();
        this.threads++;
        const index = job.value[0];
        const params = job.value[1];

        // Remove (claim) it
        this.jobs.delete(index);

        // Check if we have read file. If not, read it into file data
        let file_data = this.file_data.get(params.track_id);
        if (!file_data) {
            const path = this.files.get(params.track_id);
            this.file_data.set(params.track_id, await fs.readFile(path));
        }

        // Run the job (index file)
        await this.index_data(this.file_data.get(params.track_id), params.track_id, params.format);

        // Check if any more jobs need this file
        let jobs_with_file = 0;
            this.jobs.forEach((value, key, map) => {
                if (value.track_id == params.track_id) jobs_with_file++;
        });

        // Remove usued file data
        if (jobs_with_file == 0) {
            this.files.delete(params.track_id);
            this.file_data.delete(params.track_id);
        }

        // Keep the chain going
        this.check_jobs();
    }

    async index_meta(file) {
        // Get and parse metadata
        const file_path = path.join(file.parentPath, file.name);
        const data = await parse_metadata(file_path);

        // Add artist(s) if it does not exist yet
        let artists = data.common.artists || false;
        let artist_ids = [];
        let album_artist = data.common.albumartist || artists[0] || false;

        if (!artists) {
            database.log_error("artist", file_path, "no artists found");
            return false;
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
            return false;
        }

        let album_id = database.get_album_name(album);

        if (!album_id) {
            let album_image = null;

            // Check folder for album cover, in both jpg and png
            let cover_path = path.join(file.parentPath, "cover.jpg");
            if (existsSync(cover_path))
                album_image = await fs.readFile(cover_path);

            cover_path = path.join(file.parentPath, "cover.png");
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
            return false;
        }

        let number = data.common.track.no || 0;
        if (!number) {
            database.log_error("track", file_path, "no track number found");
        }

        // Find highest fitting quality level (for now, just check if it is higher than 44.1khz 16 bit)
        const sample_rate = data.format.sampleRate;
        const bit_depth = data.format.bitsPerSample;

        let format = 1;
        if (sample_rate <= 44100 && bit_depth <= 16)
            format = 2;
        
        // Add track if it does not exist
        const track_id = database.create_track(track, number, album_id, file_path, {
            format: format,
            duration: data.format.duration,
            sample_rate: data.format.sampleRate
        });

        if (!track_id)
            return false; // Track already exists. Do NOT index it

        // Add track artists
        for (let i = 0; i < artists.length; i++) {
            const track_artist = database.create_track_artist(track_id, artist_ids[i]);
            if (!track_artist)
                database.log_error("track_artist", file_path, `failed to add track artist "${artists[i]}"`);
        }

        // Add track to search index
        let keywords = "";
        keywords += `${track} ${number} ${album}`;
        for (let i = 0; i < artists.length; i++) {
            keywords += ` ${artists[i]}`;
        }

        database.create_search_entry(track_id, track, album, artists);

        // Return info
        return {
            format: format,
            sample_rate: sample_rate,
            bit_depth: bit_depth,
            track_id: track_id,
            track_name: track
        };
    }

    async transcode(data, format) {
        let params;
        const input = "pipe:0";
        let output = "pipe:1";

        // Get frame size (if not present, use defaults)
        const opus_frame_size = (process.env.opus_frame_size || 960) / 48; // samples / 48000 * 1000 ms
        const flac_frame_size = process.env.flac_frame_size || 4096;

        // FLAC MAX, CD, AND OPUS
        if (format == 1)
            params = ["-f", "flac", "-i", input, "-frame_size", flac_frame_size, "-f", "flac", output];
        else if (format == 2)
            params = ["-f", "flac", "-i", input, "-frame_size", flac_frame_size, "-ar", "44100", "-sample_fmt", "s16", "-f", "flac", output]; // Downsample to 44.1khz, 16 bit
        else if (format >= 3)
            params = ["-f", "flac", "-i", input, "-c:a", "libopus", "-ar", "48000", "-b:a", "128k", "-application", "audio", "-frame_duration", opus_frame_size, "-vbr", "on", "-f", "opus", output]; // Set bitrate, frame length, type, variable bitrate and fullband

        // OPUS BITRATES
        if (format == 3)
            params[9] = "256k"; // 256 kbps
        else if (format == 4)
            params[9] = "128k"; // 128 kbps (default)
        else if (format == 5)
            params[9] = "64k"; // 64 kbps
        else if (format == 6)
            params[9] = "24k"; // 24 kbps

        // Be quiet!
        params.push("-loglevel", "error");

        // Eat output
        let output_arr = [];
        let len_arr = [];

        let resolve, reject;
        let promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });

        // Spawn FFmpeg and do stuff with outputs
        const ffproc = spawn("ffmpeg", params);

        ffproc.stdout.on("data", (data) => {
            output_arr.push(data);
            len_arr.push(data.byteLength);
        });

        ffproc.stderr.on("data", (data) => {
            console.log(`Ffmpeg error: ${data}`);
            reject(data);
        });

        ffproc.on("close", (code) => {
            //console.log(`FFmpeg closed with code ${code} for format ${format}.`);
            resolve(); 
        });

        const inputStream = new Readable();
        inputStream.push(data);
        inputStream.push(null); // Signal end of stream
        inputStream.pipe(ffproc.stdin);

        // Wait for transcoding to finish
        await promise;

        // Combine into one buffer and return
        let tot_len = 0;
        for (let i = 0; i < len_arr.length; i++) {
            tot_len += len_arr[i];
        }

        const arrbuf = new Uint8Array(tot_len);
        let offset = 0;
        for (let i = 0; i < output_arr.length; i++) {
            arrbuf.set(output_arr[i], offset);
            offset += len_arr[i];
        }

        this.threads--;
        return arrbuf;
    }

    async index_data(data, id, format) {
        // Get and parse audio data
        const mimetype = `audio/${(format < 3) ? "flac" : "ogg"}`; // audio/flac, audio/ogg (opus)
        const parser = new codec_parser(mimetype);
        const file_data = await this.transcode(data, format);
        let frames = parser.parseAll(file_data);
        if (format >= 3) {
            // Get all OpusFrame-s from the OggPage-s
            let opus_frames = [];
            for (let i = 0; i < frames.length; i++) {
                for (let j = 0; j < frames[i].codecFrames.length; j++) {
                    opus_frames.push(frames[i].codecFrames[j]);
                }
            }

            frames = opus_frames;
        }

        // Add frames in one single transaction
        const tot_size = database.create_track_frames(id, format, frames);

        //for (let index = 0; index < num_frames; index++) {
        //    // Get frame data
        //    const frame_data = frames[index].data; //format <= 2 ? frames[index].data : frames[index].rawData;
//
        //    // Add to database
        //    const result = database.create_track_frame(id, format, index, frame_data);
        //    if (!result)
        //        console.warn(`Error indexing frame data for track "${track}" [ID ${track_id}] at index #${index}.`);
//
        //    tot_size += frame_data.byteLength;
        //}

        return tot_size;
    }

    async scan(directory) {
        console.log(`\nIndexing tracks from "${directory}"...`);

        // Check if directory exists
        if (!existsSync(directory)) {
            console.log("Indexing failed. Directory is not available.");
            return false;
        }

        // Find all .flac files here, and print out metadata.
        const files = (await fs.readdir(directory, { withFileTypes: true, recursive: true }))
                        .filter(dirent => dirent.isFile() && dirent.name.endsWith(".flac"));

        const num_files = files.length;
        process.stdout.write(`\Scanning ${num_files} files for indexing...\n`);

        for (let i = 0; i < files.length; i++) {
            const time_start = performance.now();
            
            const file = files[i];
            const file_path = path.join(file.parentPath, file.name);

            // Check that we have not parsed this before
            if (database.get_track_by_path(file_path))
                continue;

            // Add metadata to database, skip track if failed
            const meta_status = await this.index_meta(file);
            if (!meta_status)
                continue;

            // Store for the jobs
            this.files.set(meta_status.track_id, file_path);

            // Add transcoding to quality levels we need to queue of jobs
            for (let format = meta_status.format; format <= 6; format++) {
                this.job_index++;
                this.jobs.set(this.job_index, {
                    track_id: meta_status.track_id,
                    format: format
                });
            }
        }

        // If no jobs, say so
        const total_jobs = this.jobs.size;
        if (total_jobs == 0) {
            console.log("Database is up to date!");
            return;
        }

        // Start indexing of everything and log progress (setInterval, overwrite same line, with progress of jobs)
        console.log(`Found ${this.files.size} tracks for indexing. Transcoding to ${total_jobs} tracks and quality levels.`);

        // Start
        for (let i = 0; i < this.max_threads; i++)
            this.check_jobs();
        
        while (this.jobs.size !== 0) {
            // Print info
            Utils.overwrite_line(`Finished ${total_jobs - this.jobs.size} of ${total_jobs} jobs. [${(100 * (total_jobs - this.jobs.size) / total_jobs).toFixed(2)}%].`);

            // Wait
            await Utils.wait(1000);
        }

        Utils.overwrite_line(`Finished ${total_jobs} of ${total_jobs} jobs. [100.00%].\n`);
        console.log("Database is up to date.");

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