// Polyphonic Algorithmic Music Synthesizer for Ayatrisya AI
// Parent Company: Ametesx

export function generateProceduralWav(prompt: string, durationSeconds = 8): Buffer {
  const duration = Math.min(Math.max(durationSeconds, 2), 30);
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2; // 16-bit mono

  const p = prompt.toLowerCase();

  // Root note selection based on prompt
  let rootFreq = 220.0; // A3 default (chill / ambient)
  let tempo = 100; // BPM

  if (p.includes("upbeat") || p.includes("dance") || p.includes("fast") || p.includes("party")) {
    rootFreq = 261.63; // C4
    tempo = 128;
  } else if (p.includes("epic") || p.includes("cinematic") || p.includes("dramatic")) {
    rootFreq = 146.83; // D3
    tempo = 85;
  } else if (p.includes("cyber") || p.includes("synthwave") || p.includes("techno")) {
    rootFreq = 164.81; // E3
    tempo = 120;
  } else if (p.includes("lofi") || p.includes("relax") || p.includes("peaceful") || p.includes("sleep")) {
    rootFreq = 174.61; // F3
    tempo = 72;
  }

  // Harmonic intervals: Root, Minor 3rd / Major 3rd, 5th, Octave
  const chordIntervals = p.includes("sad") || p.includes("dark") || p.includes("minor")
    ? [1.0, 1.1892, 1.4983, 2.0] // Minor chord ratios
    : [1.0, 1.2599, 1.4983, 2.0]; // Major chord ratios

  const samples = Buffer.alloc(dataSize);
  const beatSec = 60 / tempo;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const currentBeat = Math.floor(t / beatSec);
    const beatFraction = (t % beatSec) / beatSec;

    // Pluck / note envelope
    const envelope = Math.exp(-beatFraction * 4.0);

    // Arpeggiated melody note
    const noteIdx = currentBeat % chordIntervals.length;
    const noteFreq = rootFreq * chordIntervals[noteIdx];

    // Melodic lead oscillator (sine with soft harmonics)
    const lead = (
      Math.sin(2 * Math.PI * noteFreq * t) * 0.4 +
      Math.sin(4 * Math.PI * noteFreq * t) * 0.15 +
      Math.sin(6 * Math.PI * noteFreq * t) * 0.05
    ) * envelope;

    // Atmospheric warm pad oscillator (sub-octave + 5th)
    const pad = (
      Math.sin(2 * Math.PI * (rootFreq * 0.5) * t) * 0.2 +
      Math.sin(2 * Math.PI * (rootFreq * 0.5 * 1.5) * t) * 0.15
    ) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 0.2 * t));

    // Rhythm kick / pulse
    const kickEnv = Math.exp(-beatFraction * 14.0);
    const kickFreq = 65 * Math.exp(-beatFraction * 8.0);
    const kick = Math.sin(2 * Math.PI * kickFreq * t) * kickEnv * 0.35;

    // Combine & soft clip
    const combined = lead + pad + kick;
    const clamped = Math.max(-1.0, Math.min(1.0, combined * 0.8));

    const int16 = Math.floor(clamped * 32767);
    samples.writeInt16LE(int16, i * 2);
  }

  // Construct WAV Header (44 bytes)
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(36 + dataSize, 4); // ChunkSize
  header.write("WAVE", 8, 4, "ascii");
  header.write("fmt ", 12, 4, "ascii");
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(1, 22); // NumChannels (1 = Mono)
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(sampleRate * 2, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  header.writeUInt16LE(2, 32); // BlockAlign (NumChannels * BitsPerSample/8)
  header.writeUInt16LE(16, 34); // BitsPerSample
  header.write("data", 36, 4, "ascii");
  header.writeUInt32LE(dataSize, 40); // Subchunk2Size

  return Buffer.concat([header, samples]);
}
