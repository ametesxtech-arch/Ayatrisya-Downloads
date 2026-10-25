// Audio Validator for Ayatrisya AI (WAV and MP3 containers)
// Validates genuine binary audio structure, sample rate, channels, and nonzero duration

export interface AudioValidationResult {
  valid: boolean;
  error?: string;
  format?: "WAV" | "MP3";
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
}

export function validateAudioBuffer(buffer: Uint8Array | Buffer, expectedFormat?: "WAV" | "MP3"): AudioValidationResult {
  // Check for disguised image files
  if (buffer.byteLength >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { valid: false, error: "The returned file is a PNG image, not an audio file." };
  }
  if (buffer.byteLength >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: false, error: "The returned file is a JPEG image, not an audio file." };
  }

  // Check for HTML or JSON error responses
  const textStart = new TextDecoder().decode(buffer.subarray(0, Math.min(128, buffer.byteLength))).trim();
  if (textStart.startsWith("<!DOCTYPE") || textStart.startsWith("<html") || textStart.includes("<html")) {
    return { valid: false, error: "The audio endpoint returned an HTML error page instead of audio data." };
  }
  if (textStart.startsWith("{") || textStart.startsWith("[")) {
    return { valid: false, error: "The audio endpoint returned JSON text instead of audio data." };
  }

  if (buffer.byteLength < 44) {
    return { valid: false, error: "The audio data is too short to be a valid audio file (minimum 44 bytes)." };
  }

  const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46; // RIFF
  const isWave = buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45; // WAVE
  const isId3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33; // ID3
  const isMp3Sync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;

  if (isRiff && isWave) {
    if (expectedFormat && expectedFormat !== "WAV") {
      return { valid: false, error: `The returned file is WAV audio, but ${expectedFormat} was requested.` };
    }

    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const riffSize = view.getUint32(4, true);
    // RIFF chunk size is file size - 8. Allow minor padding.
    if (riffSize + 8 > buffer.byteLength + 4) {
      return { valid: false, error: `The WAV file header declares ${riffSize + 8} bytes, but actual data is truncated (${buffer.byteLength} bytes).` };
    }

    // Locate fmt and data chunks
    let offset = 12;
    let fmtParsed = false;
    let dataParsed = false;
    let sampleRate = 0;
    let channels = 0;
    let byteRate = 0;
    let bitsPerSample = 0;
    let dataLength = 0;

    while (offset + 8 <= buffer.byteLength) {
      const chunkId = String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]);
      const chunkSize = view.getUint32(offset + 4, true);
      const chunkDataOffset = offset + 8;

      if (chunkId === "fmt ") {
        if (chunkSize >= 16 && chunkDataOffset + 16 <= buffer.byteLength) {
          channels = view.getUint16(chunkDataOffset + 2, true);
          sampleRate = view.getUint32(chunkDataOffset + 4, true);
          byteRate = view.getUint32(chunkDataOffset + 8, true);
          bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
          fmtParsed = true;
        }
      } else if (chunkId === "data") {
        dataLength = Math.min(chunkSize, buffer.byteLength - chunkDataOffset);
        dataParsed = true;
        break;
      }

      offset = chunkDataOffset + chunkSize + (chunkSize % 2); // 2-byte alignment
    }

    if (!fmtParsed || sampleRate <= 0 || channels <= 0) {
      return { valid: false, error: "The WAV file does not contain a valid format descriptor." };
    }
    if (!dataParsed || dataLength <= 0) {
      return { valid: false, error: "The WAV file contains zero audio samples." };
    }

    const calcByteRate = byteRate > 0 ? byteRate : sampleRate * channels * (bitsPerSample / 8 || 2);
    const durationSeconds = calcByteRate > 0 ? Math.round((dataLength / calcByteRate) * 10) / 10 : 0;

    if (durationSeconds <= 0) {
      return { valid: false, error: "The WAV audio file has zero duration." };
    }

    return {
      valid: true,
      format: "WAV",
      durationSeconds,
      sampleRate,
      channels,
      bitsPerSample,
    };
  }

  if (isId3 || isMp3Sync) {
    if (expectedFormat && expectedFormat !== "MP3") {
      return { valid: false, error: `The returned file is MP3 audio, but ${expectedFormat} was requested.` };
    }
    if (buffer.byteLength < 128) {
      return { valid: false, error: "The MP3 file data is too small to contain valid audio frames." };
    }
    return {
      valid: true,
      format: "MP3",
    };
  }

  return { valid: false, error: "The audio file has an invalid signature (expected RIFF/WAVE or MP3 header)." };
}
