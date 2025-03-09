const audioCtx = new AudioContext();

function prepare_source(data, length, samplerate) {
  // Create an empty three-second stereo buffer at the sample rate of the AudioContext
  const buffer = audioCtx.createBuffer(
    2,
    length,
    samplerate,
  );

  // Fill the buffer with white noise
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const nowBuffering = buffer.getChannelData(channel);

    for (let i = 0; i < buffer.length; i++) {
      let volume = 0.0001;

      nowBuffering[i] = (0.5 + Math.tan(i / 800) * 0.5) % 1;
    }
  }

  // Get an AudioBufferSourceNode
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);

  return source;
}

// start the source playing
document.querySelector("#play").addEventListener("click", () => {
  prepare_source(null, 4410, 44100).start();
})

