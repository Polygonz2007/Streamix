// Transcodes original file quality to whatever quality is requested by user.
// Does not transcode worse quality to a better quality as that it wasteful..


// Check what needs to be done
// Decode FLAC / whatever else
// Re-encode as other format
// Give back to streamig module


// Imports
import { FLACDecoder } from '@wasm-audio-decoders/flac';
import { OpusDecoder } from 'opus-decoder';

import { StreamEncoder } from 'flac-bindings';
import discordjs_opus from '@discordjs/opus';
const { OpusEncoder } = discordjs_opus;

import * as database from "./database.js";
import Stats from "./stats.js";

const Stream = class {
    constructor() {
        this.ready = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        // PLAYBACK
        this.format = 1;
        this.track_id = 0;
        this.block_index = 0;

        // OPUS
        this.buffer_pos = 0;
        this.buffer = [ // trash for now
            [], //Float32Array(4096 * 4),
            [], //Float32Array(4096 * 4)
        ]; // Decoded samples are shoved in here for encoding
        
        this.bitrate = 384; // Kbps
        this.samplerate = 48_000;
        this.opus_buf_size = 2880;
    }

    async load() {
        // Create decoders
        this.decoders = {};
        this.decoders.flac = new FLACDecoder();
        this.decoders.opus = new OpusDecoder();

        // Create encoders
        this.encoders = {};
        //this.encoders.flac = new StreamEncoder({
        //    channels: 2,         // 2 channels (left and right)
        //    bitsPerSample: 16,   // 16-bit samples
        //    samplerate: 44100,   // 44,100 Hz sample rate
        //    compressionLevel: 8, // Mm yes
        //});
        this.encoders.opus = new OpusEncoder(48000, 2);
        this.encoders.opus.setBitrate(8);

        // Wait
        await this.decoders.flac.ready;
        await this.decoders.opus.ready;

        // Finished loading
        this._resolve();
    }

    async get_next_opus(data) {
        console.log("OPUSSS LETS GO")

        while (this.buffer[0].length < this.opus_buf_size) {
            console.log("getting more data")
            // Get next buffer (pcm) and put in
            const pcm = await this.get_next_data(true);
            
            const len = pcm[0].length;
            for (let i = 0; i < len; i += 2) {
                this.buffer[0].push(pcm[0][i]);
                this.buffer[0].push(pcm[1][i]);
            }
        }

        // Splice off the stuff we need
        const tbencoded = this.buffer.splice(0, this.opus_buf_size);

        // Encode opus
        const encoded = this.encoders.opus.encode(tbencoded);
        console.log(encoded)
        
        // Construct buffer
        // 16B REQ ID
        // 8B FORMAT (3 High, 4 Mid, 5 Low, 6 Trash)
        // since opus, no number of frames, just 2880 samples each time :D

        // Return
    }

    async get_next_flac(data, downsample) {
        // Get data
        const result = await this.get_next_data(false);
        let format = data.format;

        // Downsample if quality

        // Create buffer
        // If we dont have any frames, the song is done
        if (!result) {
            format = 0; // Answer with format 0. Don't get or send any data
        }
        
        console.log(result)
        const num_frames = result.num_frames || 0;
        const block_size = result.block_size || 0;
        const block_data = result.block_data;

        // Create buffer with message type and buffer index and frame data
        const metadata_size = 4;
        const total_size = metadata_size + block_size;
        const buffer = Buffer.alloc(total_size);

        // Write metadata - IIFN
        console.log(`REQUEST ID ${data.req_id}`)
        buffer.writeUInt16LE(data.req_id, 0);  // Request ID
        buffer.writeUInt8(format, 2);     // Format (0: no data, 1: MAX Flac, 2: CD flac)
        buffer.writeUInt8(num_frames, 3); // Number of frames (max 255)

        // Copy data into buffer (frame lengths and data)
        if (format != 0) {
            let offset = metadata_size;
            Buffer.from(block_data).copy(buffer, offset);
        }
        
        // Send to client
        Stats.log("num_buffers");
        Stats.log("buffer_get", total_size);

        // Rteurn
        return buffer;
    }

    async downsample_flac(pcm) {
        // do filtering (maybe just ignore)

        // encode
        let result = [];

    }

    async get_next_data(decode) {
        console.log(`Fetching block data for track #${this.track_id} at block id #${this.block_index}`)

        // Get data and increment block index
        const result = database.get_track_data(this.track_id, 0, this.block_index);
        this.block_index++;

        // If we dont need to decode just return
        if (!decode)
            return result;
    
        // Decode into samples and return
        // Return as normal array for now :sob:
        console.log(result)
        const data = result.block_data;

        // Split data into frames
        let frames = [];
        const frame_count = result.num_frames;
        const metadata_size = frame_count * 2; // 6 bytes of metdata and then 2 * n bytes of lengths

        let offset = metadata_size;
        for (let i = 0; i < frame_count; i++) {
            // Get and push frame to array
            const length = data.readUint16LE(i * 2, true);
            frames.push(new Uint8Array(data, offset, length));
            offset += length;
        }

        const decoded = await this.decoders.flac.decodeFrames(frames);

        return decoded.channelData;
    }

    set quality(format) {
        if (format == 3)
            this.bitrate = 384;
        else if (format == 4)
            this.bitrate = 192;
        else if (format == 5)
            this.bitrate = 96;
        else if (format == 6)
            this.birate = 8;
        else
            console.error("wtf man");
    }

    get quality() {
        return this._quality;
    }
}

export default Stream;