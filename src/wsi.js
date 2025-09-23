
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

    if (data.format == 1)
        return await client.stream.get_next_flac(data, false); // no downsample
    else if (data.format == 2)
        return await client.stream.get_next_flac(data, true); // downsample
    else if (data.format >= 3)
        return await client.stream.get_next_opus(data);

    return response(data.req_id, 1); // bad!!
}

export async function seek_to(client, data) {
    
}

export async function log_played(client, data) {
    
}