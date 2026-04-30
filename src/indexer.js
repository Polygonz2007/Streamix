// Find all music and puts it in the database. Also updates database when files change.

import * as fs from "fs/promises";
import { existsSync, read } from "fs";
import path from "path";
import { parseFile as parse_metadata } from 'music-metadata';

import * as database from "./db/database.js";
import * as dbi from "./db/dbi.js";

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
        this.max_level = 0; // Highest quality level that the indexer will index to

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

        // Add to database
        let creator_type = "artist";

        let collection_type = "album";
        if (data.common.track.of <= 6)
            collection_type = "ep";
        if (data.common.track.of == 1)
            collection_type = "single";

        const creator_id = dbi.creator(data.common.albumartist || data.common.artists[0], creator_type, true);
        const collection_id = dbi.collection(data.common.album, collection_type, creator_id, true);
        const track_id = dbi.track(data.common.title, data.common.track.no, data.common.disk.no, data.format.duration, data.common.releasedate, collection_id, data.common.artists || [], data.common.genre || []);

        // Later add more data
        return {
            creator_id: creator_id,
            collection_id: collection_id,
            track_id: track_id,

            lossless: data.format.lossless,
            samplerate: data.format.sampleRate,
            bitrate: data.format.bitrate,
            bitdepth: data.format.bitsPerSample
        };
    }

    async transcode(data, format) {
        const input = "pipe:0";
        let output = "pipe:1";

        // Get frame size (if not present, use defaults)
        const opus_frame_size = (process.env.opus_frame_size || 960) / 48; // samples / 48000 * 1000 ms
        const flac_frame_size = process.env.flac_frame_size || 4096;

        // Parse format data
        // INPUT
        let params = ["-i", input]

        // ENCODER (c:a, application)
        params.push("-c:a", format.encoder);

        if (format.encoder == "libopus") {
            params.push("-application", "audio");
            params.push("-frame_duration", opus_frame_size);
        } else if (format.encoder == "libflac") {
            params.push("-frame_size", flac_frame_size);
        }

        // SAMPLERATE
        params.push("-ar", format.samplerate)

        // SAMPLE_FORMAT
        if (format.bitdepth)
            params.push("-sample_fmt", format.bitdepth == 16 ? "s16" : "s32");

        // VBR
        if (format.vbr)
            params.push("-vbr", format.vbr ? "on" : "off");

        // BITRATE
        if (format.bitrate)
            params.push("-b:a", `${format.bitrate}k`);

        // OUTPUT
        if (format.encoder == "libopus")
            params.push("-f", "opus");
        else if (format.encoder == "libflac")
            params.push("-f", "flac");
        
        params.push(output);

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
        let mimetype; // audio/flac, audio/ogg (opus)
        if (format.encoder == "libflac") mimetype = "audio/flac";
        if (format.encoder == "libopus") mimetype = "audio/ogg";

        // Transcode file to frames
        const parser = new codec_parser(mimetype);
        const file_data = await this.transcode(data, format);
        let frames = parser.parseAll(file_data);

        // Get all OpusFrame-s from the OggPage-s
        if (format.encoder == "libopus") {
            let opus_frames = [];
            for (let i = 0; i < frames.length; i++) {
                for (let j = 0; j < frames[i].codecFrames.length; j++) {
                    opus_frames.push(frames[i].codecFrames[j]);
                }
            }

            frames = opus_frames;
        }

        // Add frames to database
        const tot_size = database.add_track_frames(id, format.id, frames);

        return tot_size;
    }

    async scan(directory) {
        console.log(`\nIndexing tracks from "${directory}"...`);
        const time_start = performance.now();

        // Check if directory exists
        if (!existsSync(directory)) {
            console.log("Indexing failed. Directory is not available.");
            return false;
        }

        // Get formats ordered by level
        const formats = database.get_formats();

        // Find all .flac files here
        const files = (await fs.readdir(directory, { withFileTypes: true, recursive: true }))
                        .filter(dirent => dirent.isFile() && dirent.name.endsWith(".flac"));

        for (let i = 0; i < files.length; i++) {    
            const file = files[i];
            const file_path = path.join(file.parentPath, file.name);

            // Check that we have not parsed this before
            //if (database.get_track_by_path(file_path))
            //    continue;

            // Add metadata to database, skip track if failed
            const meta = await this.index_meta(file);
            if (!meta)
                continue;

            // Store for the jobs
            this.files.set(meta.track_id, file_path);

            // Transcode to minimum quality level
            this.add_job(meta.track_id, formats[0]);

            // Then add levels until it becomes unreasonable
            for (let i = 1; i < formats.length; i++) {
                continue;
                const format = formats[i];
                
                if (meta.lossless >= format.lossless)
                    continue;

                if (!meta.lossless && meta.bitrate < format.bitrate)
                    continue;

                if (meta.lossless && meta.samplerate < format.samplerate)
                    continue;

                if (meta.lossless && meta.bitdepth < format.bitdepth)
                    continue;

                // Good to go
                this.add_job(meta.track_id, formats[i]);
            }

            Utils.overwrite_line(`Scanned ${i} of ${files.length} files. [${(100 * i / files.length).toFixed(2)}%].`);
        }

        // If no jobs, say so
        const total_jobs = this.jobs.size;
        if (total_jobs == 0)
            return;

        // Start indexing of everything and log progress (setInterval, overwrite same line, with progress of jobs)
        Utils.overwrite_line(`Found ${this.files.size} tracks for indexing.`);

        // Start
        for (let i = 0; i < this.max_threads; i++)
            this.check_jobs();
        
        while (this.jobs.size !== 0) {
            // Print info and wait
            Utils.overwrite_line(`Finished ${total_jobs - this.jobs.size} of ${total_jobs} jobs. [${(100 * (total_jobs - this.jobs.size) / total_jobs).toFixed(2)}%].`);
            await Utils.wait(1000);
        }

        const time_end = performance.now();
        Utils.overwrite_line(`Successfully indexed ${files.length} tracks [${total_jobs} jobs] in ${((time_end - time_start) / (60 * 1000)).toFixed(2)} minutes.\n`);

        return true;
    }

    add_job(track_id, format) {
        this.job_index++;
        this.jobs.set(this.job_index, {
            track_id: track_id,
            format: format
        });
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