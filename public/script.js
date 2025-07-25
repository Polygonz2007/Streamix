
const doc = document;

///  IMPORTS  ///
import Comms from "./comms.js";
import Library from "./library.js";

///  ELEMENTS  ///
// Controls
const controls = doc.querySelector("#controls");
const next_btn = doc.querySelector("#next");
const prev_btn = doc.querySelector("#previous");

const pause_btn = doc.querySelector("#pause");

const seekbar = {
  time_played: doc.querySelector("#time-played"),
  range: doc.querySelector("#seekbar"),
  time_remaining: doc.querySelector("#time-remaining")
}

// Album cover
const album_cover_img = doc.querySelector("#album-cover");
const background_img = doc.querySelector("#background-image");

// Track details
let details_box = {};
details_box.title = doc.querySelector("#title");
details_box.artist = doc.querySelector("#artist > .text");
details_box.album = doc.querySelector("#album > .text");

details_box.album_full = doc.querySelector("#album");

// Library
let library = {
  searchbar: doc.querySelector("#library > #search"),
  results: doc.querySelector("#library > #results")
}

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
  audioCtx = new AudioContext({ "latencyHint": "playback" });
else
  alert("Your browser does not support AudioContext. Please upgrade your browser to use this service.");

const player = {
  // General
  volume: 1,
  speed: 1,

  // Track playback
  track_id: 0,
  block_index: 0,
  sample_rate: 0,
  track_duration: 0,

  started_time: 0,
  played_time: 0,
  time: 0,

  // Audio handling
  buffers: [],
  active_buffer: 0, // which one is playing RN
  headroom: 0 // the amount of buffers after this one
}

// Replace with something that makes more sense and stuff, actually just replace everything here
next_btn.addEventListener("click", () => {
  player.track_id++;
  start_track(player.track_id);
});

prev_btn.addEventListener("click", () => {
  player.track_id--;
  start_track(player.track_id);
});


// Websocket
const url = `ws://${window.location.host}`;
const socket = new WebSocket(url);

socket.addEventListener("open", () => {
  // Yay
});

socket.addEventListener("message", async (event) => {
  const data = await event.data.arrayBuffer();
  
  // Get type
  const data_view = new DataView(data)
  const type = data_view.getUint8(0);

  switch (type) {
    case 0:
      console.log("yo")
      // Get format of data, to decide how to decode
      const format = data_view.getUint8(1);
      if (format !== 0) // if format is not flac
        return;

      // Get buffer index, check order
      const buffer_index = data_view.getUint16(2, true);
      console.log(buffer_index)
      //if (buffer_index != player.block_index)
      //  return;

      // Split data into frames
      let frames = [];
      const frame_count = data_view.getUint16(4, true);
      const metadata_size = 6 + frame_count * 2; // 6 bytes of metdata and then 2 * n bytes of lengths

      let offset = metadata_size;
      for (let i = 0; i < frame_count; i++) {
        // Get and push frame to array
        const length = data_view.getUint16(6 + i * 2, true);
        frames.push(new Uint8Array(data, offset, length));
        offset += length;
      }

      // Decode data
      if (!decoder.ready)
        return;

      const decoded = await decoder.decodeFrames(frames);

      // Shift buffer and put in data
      //active_buffer = buffer_index; // = 1 - active_buffer;
      
      console.log(decoded.samplesDecoded)
      const source = prepare_source(decoded.channelData, decoded.samplesDecoded, player.sample_rate * player.speed);
      source.source.start(player.time);//(buffer_index * player.bufferLengthSeconds / player.speed));
      player.time += source.source.buffer.duration;
      player.block_index++;
      ws_request("track_data_block", { block_index: player.block_index, track_id: player.track_id });
      //if (buffer_index == 0) {
      //  player.start_time = audioCtx.currentTime;
      //  resume();
      //  //ws_request("next_buf");
      //}

      //player.duration_time += audio_buffer[active_buffer].buffer.duration;

      //audio_buffer[active_buffer].source.addEventListener('ended', () => {
      //  ws_request("next_buf");
      //});

      return;


    case 1:
      for (let i = 0; i < audio_buffer.length; i++) {
        if (audio_buffer[i])
          audio_buffer[i].source.stop();
      }

      audio_buffer = [];
      audioCtx.currentTime = 0;

      // Put song playback info
      const info = get_json(data);
      console.log(`Loading song "${info.title}".`)

      player.sampleRate = info.sampleRate;
      player.sampleDuration = info.duration * info.sampleRate;

      player.duration = info.duration;
      player.start_time = 0;
      player.duration_time = 0;

      player.bufferLength = info.bufferLength;
      player.bufferLengthSeconds = player.bufferLength / player.sampleRate;

      // Last fm...
      doc.querySelector("#lastfm").setAttribute("value", `.sb ${info.artist.name} | ${info.track.name} | ${info.album.name}`);

      // Set metadata display
      details_box.title.innerText = info.track.name;
      details_box.artist.innerText = info.artist.name;
      details_box.album.innerText = info.album.name;

      // Get size of thang
      const size = parseInt((album_cover_img.getBoundingClientRect().width - 6) * window.devicePixelRatio);

      // Set album cover
      const cover_url = `/album/${info.album.id}/${size}.jpg`;
      album_cover_img.src = cover_url;
      background_img.src = cover_url;

      // Set up media session
      set_media_session(info);

      // Set up seekbar
      seekbar.time_played.innerText = get_timestamp(player.duration_time);
      seekbar.time_remaining.innerText = get_timestamp(player.duration_time - player.duration);

      seekbar.range.min = 0;
      seekbar.range.max = player.duration;
      seekbar.range.value = player.duration_time;

      // Clear buffer
      audio_buffer = [];
      active_buffer = -1;

      // Start playback
      ws_request("next_buf");

      return;

    case 2:
      // Remove metadata display
      //details_box.title.innerText = "Not Playing";
      //details_box.artist.innerText = "...";
      //details_box.album.innerText = "...";
//
      //// Remove album cover
      //album_cover_img.src = "/asset/logo/512/Deep.png";
      //background_img.src = "/asset/logo/512/Deep.png";;

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
})();

async function start_track(id) {
  // Get track info
  const meta = await Comms.get_json(`/track/${id}`);
  if (!meta) {
    details_box.title.innerText = "Track not found";
    details_box.artist.innerText = "---";
    details_box.album.innerText = "---";

    album_cover_img.src = "";
    background_img.src = "";

    return;
  }

  // Inform the player of this stunning revelation
  player.track_id = id;
  player.block_index = 0;
  player.sample_rate = meta.sample_rate;
  player.duration = meta.duration;

  // Display info to the user
  details_box.title.innerText = meta.track.name;
  details_box.artist.innerText = meta.artist.name;
  details_box.album.innerText = meta.album.name;

  // Get size of thang
  const size = parseInt((album_cover_img.getBoundingClientRect().width - 6) * window.devicePixelRatio);

  // Set album cover
  const cover_url = `/album/${meta.album.id}/${size}.jpg`;
  album_cover_img.src = cover_url;
  background_img.src = cover_url;

  // Get first data
  ws_request("track_data_block", { block_index: player.block_index, track_id: player.track_id });
}

window.start_track = start_track;

async function search(string) {
  const tracks = await Comms.post_json("/search", { "string": string });
  let result = [];

  Library.clear();

  for (let i = 0; i < tracks.length; i++) {
    const track = await Comms.get_json(`/track/${tracks[i].id}`);
    result.push(track);

    Library.add_track(track);
  }

  return result;
}

library.searchbar.addEventListener("keyup", () => {
  search(library.searchbar.value);
});

window.search = search;
search(library.searchbar.value);

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

  console.log("source prepared")
  return {buffer: buffer, source: source};
}



// Controls
function pause() {
  audioCtx.suspend();
  controls.classList.add("paused");
}

function resume() {
  audioCtx.resume();
  controls.classList.remove("paused");
}

pause_btn.addEventListener("click", () => {
  if (audioCtx.state == "running")
    pause();
  else
    resume();
})

doc.addEventListener("keypress", (e) => {
  if (e.key == " ") {
    if (audioCtx.state == "running")
      pause();
    else
      resume();
  }
})



function get_timestamp(seconds) {
  // Flip if negative
  let prefix = "";
  if (seconds < 0) {
    seconds = -seconds;
    prefix = "-";
  }

  // Get
  let m = Math.floor(seconds / 60);
  let s = Math.floor(seconds % 60);

  // Add leading 0s
  m = m.toString();
  s = s.toString();

  if (m.length === 1)
    m = "0" + m;
  if (s.length === 1)
    s = "0" + s;

  // Add - if negative
  return `${prefix}${m}:${s}`;
}

function update_seekbar() {
  const current_time = audioCtx.currentTime - player.start_time;
  seekbar.time_played.innerText = get_timestamp(current_time);
  seekbar.time_remaining.innerText = get_timestamp(current_time - player.duration);
  seekbar.range.value = current_time;
}

setInterval(update_seekbar, 100);


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







function set_media_session(metadata) {
  if (navigator.mediaSession) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.track.name,
      artist: metadata.artist.name,
      album: metadata.album.name,
      artwork: [
        {
          src: `/album/${metadata.album.id}/img.jpg`,
          sizes: "96x96",
          type: "image/png"
        }
      ]
    });

    navigator.mediaSession.setActionHandler("play", () => {
      audioCtx.resume();
      //update_media_session_position();
      //navigator.mediaSession.playbackState = 'playing';
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      audioCtx.suspend();
      //update_media_session_position();
      //navigator.mediaSession.playbackState = 'paused';
    });

    update_media_session_position();
  }
}

function update_media_session_position() {
  navigator.mediaSession.setPositionState({
    duration: player.duration,
    playbackRate: player.speed,
    position: player.duration_time
  });
}






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

doc.getElementById("lastfm-copy").addEventListener("click", () => {
   // Get the text field
  const copyText = document.getElementById("lastfm");

  // Select the text field
  copyText.select();
  copyText.setSelectionRange(0, 99999); // For mobile devices

   // Copy the text inside the text field
  document.execCommand('copy');
});