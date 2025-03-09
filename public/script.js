const doc = document;

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
    const decoded = await decoder.decodeFrames([frame]);

    console.log(decoded.channelData, decoded.samplesDecoded);
  }

  // Audio Context
  const audioCtx = new AudioContext();

  function prepare_source(data, length, samplerate) {
    const buffer = audioCtx.createBuffer(2, length,  samplerate);

    // Fill the buffer with the data
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const nowBuffering = buffer.getChannelData(channel);
      nowBuffering[i] = data[channel];
    }

    // Get an AudioBufferSourceNode
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    return source;
  }

  // start the source playing
  //document.querySelector("#play").addEventListener("click", () => {
  //  prepare_source(null, 4410, 44100).start();
  //})


  console.log("Getting test frame");

  // Get and play frame
  try {
      const resp = await fetch("test");
      const data = await resp.json();
      console.log(data)

      // Handle response
      decode_frame(data)
  } catch {
      console.log("Couldnt do that yikes");
  }

  console.log("Fin")
})()