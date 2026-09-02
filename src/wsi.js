
// IMPORTS
import * as database from "./db/database.js";


/// FUNCTIONS ///

async function json(object) {
    return JSON.stringify(object);
}

// Set the state (track, format and frame_index) for current stream object
// TODO: Add checks that stop you from setting invalid settings
export async function set_state(client, data) {
    // Keep un-changed state
    if (!data.track_id)
        data.track_id = client.stream.track_id;

    if (!data.level)
        data.level = client.stream.level;

    if (!data.frame_index)
        data.frame_index = client.stream.frame_index;

    // Get format
    const meta = database.get_track_format_by_level(data.track_id, data.level);
    if (!meta)
        return json({ status: false, req_id: data.req_id, error: "Track does not exist or has not been indexed yet" });

    // Set state
    client.stream.track_id = data.track_id;
    client.stream.format_id = meta.id;
    //console.log(`Cache: Track #${data.track_id}, Level ${data.level}, Frame #${data.frame_index}`)
    client.stream.reload_cache(data.frame_index);

    // Respond with format data
    return json({
        status: true,
        req_id: data.req_id,

        format: meta
    });
}

export async function get_frame(client, req_id, frame_index) {
    const frame = await client.stream.get_frame(frame_index);
    if (!frame)
        return json({ status: false, req_id: req_id, error: "No data found" });

    // Add metadata
    const buffer = Buffer.alloc(4 + frame.frame_size);
    buffer.writeUint16BE(req_id, 0);
    buffer.writeUint16BE(frame.frame_size, 2);
    buffer.set(frame.frame_data, 4);

    return buffer;
}
