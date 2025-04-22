
const doc = document;

///  ELEMENTS  ///
// Controls
const play_btn = doc.querySelector("#play");
const song_field = doc.querySelector("#song");
const pause_btn = doc.querySelector("#pause");

// Album cover
const album_cover_img = doc.querySelector("#album-cover");
const background_img = doc.querySelector("#background-image");

// Track details
let details_box = {};
details_box.title = doc.querySelector("#title");
details_box.artist = doc.querySelector("#artist");
details_box.album = doc.querySelector("#album");


///  DECODER ///
let decoder;

// Tell iOS that we playing audio here bruh
if (navigator.audioSession)
  navigator.audioSession.type = "playback"

// Get audio context
const AudioContext = window.AudioContext // Default
    || window.webkitAudioContext // Safari and old versions of Chrome
    || false; 
let audioCtx;

if (AudioContext)
  audioCtx = new AudioContext();
else
  alert("Your browser does not support AudioContext. Please upgrade your browser to use this service.");

const player = {
  volume: 1,
  speed: 1,

  start_time: 0,
  duration_time: 0
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
})

socket.addEventListener("message", async (event) => {
  const data = await event.data.arrayBuffer();
  console.log(data)
  
  // Get type
  const data_view = new DataView(data)
  const type = data_view.getUint8(0);

  switch (type) {
    case 0:
      // Get format of data, to decide how to decode
      const format = data_view.getUint8(1);
      if (format !== 0) // if format is not flac
        return;

      // Get buffer index, check order
      const buffer_index = data_view.getUint16(2, true);
      console.log(`Loading buffer #${buffer_index}`);

      // Split data into frames
      let frames = [];
      const frame_count = data_view.getUint16(4, true);
      const metadata_size = 6 + frame_count * 2; // 4 bytes of metdata and then 2 * n bytes of lengths

      console.log(`Buffer #${buffer_index}.\nFormat ${format}.\nThere are ${frame_count} frames in this packet.`);

      let offset = metadata_size;
      for (let i = 0; i < frame_count; i++) {
        // Get and push frame to array
        const length = data_view.getUint16(6 + i * 2, true);
        frames.push(new Uint8Array(data, offset, length));
        offset += length;

        console.log(`Frame #${i} is ${length} bytes.`);
      }

      //// Create audio buffer
      //console.log(data.byteLength)
      //const per_channel = ((data.byteLength / 4) - 2) / 2; // 8 bit -> 32 bit -> remove two -> per channel
      //console.log("P?er channel " + per_channel)
      //
      //let channel_data = [
      //  new Float32Array(per_channel), //data.splice(per_channel)),
      //  new Float32Array(per_channel)  //data.splice(per_channel))
      //];
//
      //for (let i = 0; i < per_channel; i++) {
      //  channel_data[0][i] = data_view.getFloat32(i + 8, true) / 0xFFFF;
      //  channel_data[1][i] = data_view.getFloat32((i + per_channel) + 8, true) / 0xFFF;
      //}

      // Decode data
      console.log(decoder.ready)
      if (!decoder.ready)
        return;

      const decoded = await decoder.decodeFrames(frames);
      console.log(decoded)

      // Shift buffer and put in data
      active_buffer = buffer_index;// = 1 - active_buffer;
      
      audio_buffer[active_buffer] = prepare_source(decoded.channelData, decoded.samplesDecoded, player.sampleRate * player.speed);
      audio_buffer[active_buffer].source.start(player.start_time + player.duration_time);//(buffer_index * player.bufferLengthSeconds / player.speed));
      if (buffer_index == 0) {
        player.start_time = audioCtx.currentTime;
        ws_request("next_buf");
      }

      player.duration_time += audio_buffer[active_buffer].buffer.duration;

      audio_buffer[active_buffer].source.addEventListener('ended', () => {
        ws_request("next_buf");
      });

      return;


    case 1:
      // Put song playback info and start song
      const info = get_json(data);
      player.sampleRate = info.sampleRate;
      player.sampleDuration = info.duration * info.sampleRate;
      player.duration = info.duration;
      player.bufferLength = info.bufferLength;

      // Set metadata display
      details_box.title.innerText = info.metadata.title;
      details_box.artist.innerText = `by ${info.metadata.artist}`;
      details_box.album.innerText = `from ${info.metadata.album}`;

      // Set album cover
      const picture_data = info.metadata.cover;
      album_cover_img.src = picture_data;
      background_img.src = picture_data;

      // Set up media session
      //set_media_session(info.metadata);

      // Set up context

      // Start playback
      player.bufferLengthSeconds = player.bufferLength / player.sampleRate;
      ws_request("next_buf");

      return;

    case 10:
      return;
  }

  //console.log(await yes.bytes())
});

(async () => {
  // Load flac decoder
  const { FLACDecoderWebWorker, FLACDecoder } = window["flac-decoder"];

  decoder = new FLACDecoder();
  await decoder.ready;

  console.log("Decoder ready!")

  async function decode_frame(frame) {
    const length = frame.header.blockSize;
    let frame_data = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      frame_data[i] = frame.data[i];
    }

    console.log(frame_data)
    const decoded = await decoder.decodeFrames(frame);

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




function pause() {
  if (audioCtx.state == "running")
    audioCtx.suspend();
  else
    audioCtx.resume();
}

pause_btn.addEventListener("click", pause)

doc.addEventListener("keypress", (e) => {
  if (e.key == " ")
    pause()
})



// Server communication
async function ws_request(type, data) {
  if (!data)
    data = {};

  data.type = type;
  socket.send(JSON.stringify(data));

  return 0;
}

function get_json(data) {
  let buf = new Uint8Array(data);
  buf = buf.slice(4)

  let string = "";
  
  for (let i = 0; i < buf.length; i++) {
    string += String.fromCharCode(buf[i]);
  }

  return JSON.parse(string);
}


//
//
//
//
//
//function set_media_session(metadata) {
//  if (navigator.mediaSession) {
//    navigator.mediaSession.metadata = new MediaMetadata({
//      title: metadata.title,
//      artist: metadata.artist,
//      album: metadata.album,
//      artwork: [
//        {
//          src: metadata.cover,
//          sizes: "96x96",
//          type: "image/png"
//        }
//      ]
//    });
//
//    navigator.mediaSession.setActionHandler("play", () => {
//      audioCtx.resume();
//      update_media_session_position();
//      navigator.mediaSession.playbackState = 'playing';
//    });
//
//    navigator.mediaSession.setActionHandler("pause", () => {
//      audioCtx.suspend();
//      update_media_session_position();
//      navigator.mediaSession.playbackState = 'paused';
//    });
//
//    update_media_session_position();
//  }
//}
//
//function update_media_session_position() {
//  navigator.mediaSession.setPositionState({
//    duration: player.duration,
//    playbackRate: player.speed,
//    position: player.duration_time
//  });
//}
//
//





// ios test
//var fixAudioContext = function (e) {
//  if (audioCtx) {
//    // Create empty buffer
//    var buffer = audioCtx.createBuffer(1, 1, 22050);
//    var source = audioCtx.createBufferSource();
//    source.buffer = buffer;
//    // Connect to output (speakers)
//    source.connect(audioCtx.destination);
//    // Play sound
//    if (source.start) {
//      source.start(0);
//    } else if (source.play) {
//      source.play(0);
//    } else if (source.noteOn) {
//      source.noteOn(0);
//    }
//  }
//  // Remove events
//  document.removeEventListener('touchstart', fixAudioContext);
//  document.removeEventListener('touchend', fixAudioContext);
//};
//// iOS 6-8
//document.addEventListener('touchstart', fixAudioContext);
//// iOS 9
//document.addEventListener('touchend', fixAudioContext);