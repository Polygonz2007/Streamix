
const doc = document;
const play_btn = doc.querySelector("#play");
const song_field = doc.querySelector("#song");

const audioCtx = new AudioContext();

const player = {
  volume: 0.5, // -3db

  next_start_time: 0
}


let audio_buffer = [];
let active_buffer = 0;


// Websocket
const url = `ws://${window.location.host}`;
const socket = new WebSocket(url);

socket.addEventListener("open", () => {
  // Yay
});

play_btn.addEventListener("click", () => {
  ws_request("play", {"song": song.value});
  ws_request("next_buf");
  ws_request("next_buf");
})

socket.addEventListener("message", async (event) => {
  const data = await event.data.arrayBuffer();
  console.log(data)
  
  //switch d
  const data_view = new DataView(data)
  
  const type = data_view.getUint32(0, true);

  switch (type) {
    case 1: // Buffer data
      // Check order
      const buffer_index = data_view.getUint32(4, true);
      console.log(`Loading buffer #${buffer_index}`);

      // Create audio buffer
      console.log(data.byteLength)
      const per_channel = ((data.byteLength / 4) - 8) / 2;
      console.log("P?er channel " + per_channel)
      
      let channel_data = [
        new Float32Array(per_channel), //data.splice(per_channel)),
        new Float32Array(per_channel)  //data.splice(per_channel))
      ];

      for (let i = 0; i < per_channel; i++) {
        channel_data[0][i] = data_view.getFloat32(4 * i + 8, true);
        channel_data[1][i] = data_view.getFloat32(4 * (i + per_channel) + 8, true);
      }

      active_buffer = 1 - active_buffer;
      if (buffer_index == 0)
        player.next_start_time = audioCtx.currentTime;
      
      audio_buffer[active_buffer] = prepare_source(channel_data, per_channel, player.sampleRate);
      audio_buffer[active_buffer].source.start(player.next_start_time);
      player.next_start_time += audio_buffer[active_buffer].buffer.duration;

      audio_buffer[1 - active_buffer].source.addEventListener('ended', () => {
        ws_request("next_buf");
      });

      if (buffer_index == 0)
        active_buffer = 1 - active_buffer;
      
      return;


    case 2: // Start song
      const info = get_json(data);
      player.sampleRate = info.sampleRate;
      player.totalLength = info.totalLength;
      player.bufferLength = info.bufferLength;

      // Start playback
      player.bufferLengthMS = (player.bufferLength / player.sampleRate) * 1000;

      return;
  }

  console.log(raw)

  //console.log(await yes.bytes())
});

(async () => {
  // Flac decoder
  const { FLACDecoderWebWorker, FLACDecoder } = window["flac-decoder"];
  const decoder = new FLACDecoder();
  await decoder.ready;

  async function decode_frame(frame) {
    const length = frame.header.blockSize;
    let frame_data = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      frame_data[i] = frame.data[i];
    }

    console.log(frame_data)
    const decoded = await decoder.decode(frame);

    console.log(decoded.channelData, decoded.samplesDecoded, decoded.errors);

    prepare_source(decoded.channelData, decoded.samplesDecoded, decoded.samplerate);
  }

  // start the source playing
  //play_btn.addEventListener("click", () => {
  //  const current = audio_buffer[0];
  //  const source = prepare_source(current.data, current.samples, current.rate);
//
  //  source.start();
  //})
})()



// Audio Context
//const audioCtx = new AudioContext();

function prepare_source(data, length, samplerate) {
  const buffer = audioCtx.createBuffer(2, length, samplerate);

  // Fill the buffer with the data
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const nowBuffering = buffer.getChannelData(channel);
    console.log(data[channel])
    //nowBuffering = data[channel];

    //const interval = Math.floor(length / 20);
//
    for (let i = 0; i < length; i++) {
      nowBuffering[i] = data[channel][i] * player.volume;
    }
  }

  // Get an AudioBufferSourceNode
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);

  console.log("Starting playback")

  return {buffer: buffer, source: source};
}


// Websocket helping
async function ws_request(type, data) {
  if (!data)
    data = {};

  data.type = type;
  socket.send(JSON.stringify(data));
}







// Maybe gbet from somehwerew else
function get_json(data) {
  let buf = new Uint8Array(data);
  buf = buf.slice(4)

  console.log(buf.toString())
  const string = String.fromCharCode.apply(null, buf);
  console.log(string)
  return JSON.parse(string);
}