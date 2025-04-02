
const doc = document;
const play_btn = document.querySelector("#play");

const player = {
  volume: 0.5 // -3db
}


let audio_buffer = [];

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

  // Audio Context
  const audioCtx = new AudioContext();

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

    return source;
  }

  // start the source playing
  play_btn.addEventListener("click", () => {
    const current = audio_buffer[0];
    const source = prepare_source(current.data, current.samples, current.rate);

    source.start();
  })


  console.log("Getting test frame");

  // Get and play frame
  //try {
      const resp = await fetch("test");
      console.log(resp)
      const data = await resp.json();
      console.log(data)

      // Get data
      audio_buffer[0] = {};

      const num_samples = data.samplesDecoded;
      audio_buffer[0].samples = num_samples;
      audio_buffer[0].rate = data.sampleRate;

      audio_buffer[0].data = [];
      audio_buffer[0].data[0] = new Float32Array(num_samples);
      audio_buffer[0].data[1] = new Float32Array(num_samples);

      for (let i = 0; i < num_samples; i++) {
        if (i == 10000)
          console.log(data.channelData[0][i]);

        audio_buffer[0].data[0][i] = data.channelData[0][i];
        audio_buffer[0].data[1][i] = data.channelData[1][i];
      }

      //audio_buffer[0].data = data.channelData;

      console.log(audio_buffer[0]);

      play_btn.removeAttribute("disabled");

      // Play
      const current = audio_buffer[0];
      const source = prepare_source(current.data, current.samples, current.rate);
      source.start();

      // Handle response
      //decode_frame(data)
      console.log("decoded")
  //} catch {
  //    console.log("Couldnt do that yikes");
  //}

  console.log("Fin")
})()