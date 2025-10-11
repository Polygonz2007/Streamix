
// IMPORTS
import * as database from "./database.js";


//
// FUNCTIONS
///
function response(req_id, status) {
    let buf = new Buffer.alloc(4);
    buf.writeUInt16LE(req_id, 0);
    buf.writeUInt16LE(status, 2);
    return buf;
}

export async function set_track(client, data) {
    // Check if track exists, and get meta
    const meta = database.get_track_format(data.track_id);
    if (!meta)
        return response(data.req_id, 0); // If failed, respond with 0 (0 samplerate is not possible)

    // Set state
    client.stream.track_id = data.track_id;
    client.stream.frame_index = 0;

    // Respond with nesecarry metadata.
    const buffer_size = 2 + 4 + 4;
    const buffer = new ArrayBuffer(buffer_size);
    const buffer_view = new DataView(buffer);

    buffer_view.setUint16(0, data.req_id, true);
    buffer_view.setUint32(2, meta.sample_rate, true); // MAX SAMPLE RATE
    buffer_view.setFloat32(6, meta.duration, true); // DURATION

    return Buffer.from(buffer);
}

export async function set_format(client, data) {
    // Get track max format
    console.log("finding track format for track #" + client.stream.track_id)
    const meta = database.get_track_format(client.stream.track_id);
    if (!meta)
        return response(data.req_id, 0); // WTF HOW

    // Make sure this is reasonable
    if (meta.format > data.format)
        data.format = meta.format; // Clamp to highest possible format

    if (data.format > 6)
        data.format = 6; // huh????

    // Set state
    client.stream.req_format = data.format;

    // Respond with good code
    return response(data.req_id, data.format);
}

export async function next_buffer(client, data) {
    const frame = await client.stream.get_next_data();
    if (!frame) {
        console.log("Found no data!");
        return response(data.req_id, 0); // bad!!
    }

    // Add the req id to start
    const buffer = Buffer.alloc(frame.frame_data.length + 2);
    buffer.writeUint16LE(data.req_id, 0);
    frame.frame_data.copy(buffer, 2);

    return buffer;
}

export async function seek_to(client, data) {
    // Be dumb for now...
    client.stream.frame_index = data.frame_index;
    console.log(`Jumped to frame index ${client.stream.frame_index}`);

    return response(data.req_id, 1);
}

export async function log_played(client, data) {
    
}