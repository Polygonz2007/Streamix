
function response(req_id, status) {
    let buf = new Buffer.alloc(4);
    buf.writeUInt16LE(req_id, 0);
    buf.writeUInt16LE(status, 2);
    return buf;
}

export async function set_track(client, data) {
    client.stream.track_id = data.track_id;
    client.stream.block_index = 0;
    
    return response(data.req_id, 0);
}

export async function next_buffer(client, data) {
    const format = data.format;
    const audio_data = await client.stream.get_next_data();

    if (!audio_data)
        return response(data.req_id, 1); // bad!!

    // Add the req id to start
    const buffer = Buffer.alloc(audio_data.byteLength + 2);
    buffer.writeUint16LE(data.req_id, 0);
    audio_data.copy(buffer, 2);

    return buffer;
}

export async function seek_to(client, data) {
    
}

export async function log_played(client, data) {
    
}