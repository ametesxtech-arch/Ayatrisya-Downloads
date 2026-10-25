import "fake-indexeddb/auto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AyatrisyaModelClient } from "../ai/client";
import { repository } from "../storage/repository";

function createValidWavBinary(durationSeconds = 2, sampleRate = 8000, numChannels = 1): Uint8Array {
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * blockAlign;
  const totalLength = 44 + dataSize;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // RIFF header
  bytes[0] = 0x52; bytes[1] = 0x49; bytes[2] = 0x46; bytes[3] = 0x46; // 'RIFF'
  view.setUint32(4, 36 + dataSize, true);
  bytes[8] = 0x57; bytes[9] = 0x41; bytes[10] = 0x56; bytes[11] = 0x45; // 'WAVE'

  // fmt chunk
  bytes[12] = 0x66; bytes[13] = 0x6d; bytes[14] = 0x74; bytes[15] = 0x20; // 'fmt '
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bitsPerSample

  // data chunk
  bytes[36] = 0x64; bytes[37] = 0x61; bytes[38] = 0x74; bytes[39] = 0x61; // 'data'
  view.setUint32(40, dataSize, true);

  return bytes;
}

function createValidMp3Binary(): Uint8Array {
  // Minimal MP3 frame header with MPEG sync
  const bytes = new Uint8Array(256);
  bytes[0] = 0xff;
  bytes[1] = 0xfb; // Sync word 11111111 11111011 (MPEG 1 Layer 3, no CRC)
  bytes[2] = 0x90; // 128 kbps, 44.1 kHz
  bytes[3] = 0x00;
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

describe("Real Music Generation and Multimodal Output Workflow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully decodes genuine WAV audio and validates RIFF/WAVE container and duration", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "music"], attachments: true },
    ]);

    const validWavBytes = createValidWavBinary(20);
    const validWavBase64 = bytesToBase64(validWavBytes);

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "drums.wav",
        mimeType: "audio/wav",
        dataBase64: validWavBase64,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await client.generateAsset("music", "drums", {
      model: "v1-fast",
      format: "WAV",
      durationSeconds: 20,
    });

    expect(result.fileName).toBe("drums.wav");
    expect(result.blob.type).toBe("audio/wav");
    expect(result.blob.size).toBe(validWavBytes.length);

    // Verify WAV headers
    const buf = await result.blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const wave = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    expect(riff).toBe("RIFF");
    expect(wave).toBe("WAVE");
  });

  it("supports JSON metadata containing a downloadable audio file URL", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "music"], attachments: true },
    ]);

    const validWavBytes = createValidWavBinary(15);
    const downloadUrl = "https://models.ayatrisya.example/downloads/drums.wav";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/generate/music")) {
        return new Response(JSON.stringify({
          fileName: "drums.wav",
          mimeType: "audio/wav",
          fileUrl: downloadUrl,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url === downloadUrl) {
        return new Response(validWavBytes, {
          status: 200,
          headers: { "Content-Type": "audio/wav" },
        });
      }
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await client.generateAsset("music", "drums rhythm", {
      model: "v1-fast",
      format: "WAV",
      durationSeconds: 15,
    });

    expect(result.fileName).toBe("drums.wav");
    expect(result.blob.type).toBe("audio/wav");
    expect(result.blob.size).toBe(validWavBytes.length);
  });

  it("supports MP3 format validation", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "music"], attachments: true },
    ]);

    const validMp3Bytes = createValidMp3Binary();
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "beat.mp3",
        mimeType: "audio/mpeg",
        dataBase64: bytesToBase64(validMp3Bytes),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await client.generateAsset("music", "electronic beat", {
      model: "v1-fast",
      format: "MP3",
      durationSeconds: 10,
    });

    expect(result.fileName).toBe("beat.mp3");
    expect(result.blob.type).toBe("audio/mpeg");
  });

  it("rejects PNG images disguised as audio files", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "music"], attachments: true },
    ]);
    const fakeAudioPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "ayatrisya-generated.png",
        mimeType: "audio/wav",
        dataBase64: bytesToBase64(fakeAudioPng),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      client.generateAsset("music", "drums", {
        model: "v1-fast",
        format: "WAV",
        durationSeconds: 20,
      })
    ).rejects.toThrow(/invalid signature|PNG image/i);
  });

  it("rejects HTML error pages returned in place of audio files", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "music"], attachments: true },
    ]);
    const htmlBytes = new TextEncoder().encode("<!DOCTYPE html><html><body>502 Bad Gateway</body></html>");

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "audio.wav",
        mimeType: "audio/wav",
        dataBase64: bytesToBase64(htmlBytes),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      client.generateAsset("music", "drums", {
        model: "v1-fast",
        format: "WAV",
        durationSeconds: 20,
      })
    ).rejects.toThrow(/invalid signature|HTML error/i);
  });

  it("rejects zero-duration WAV audio files", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "music"], attachments: true },
    ]);
    const emptyWav = new Uint8Array(44);
    const view = new DataView(emptyWav.buffer);
    emptyWav[0] = 0x52; emptyWav[1] = 0x49; emptyWav[2] = 0x46; emptyWav[3] = 0x46; // RIFF
    view.setUint32(4, 36, true);
    emptyWav[8] = 0x57; emptyWav[9] = 0x41; emptyWav[10] = 0x56; emptyWav[11] = 0x45; // WAVE
    emptyWav[12] = 0x66; emptyWav[13] = 0x6d; emptyWav[14] = 0x74; emptyWav[15] = 0x20; // fmt 
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true);
    view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    emptyWav[36] = 0x64; emptyWav[37] = 0x61; emptyWav[38] = 0x74; emptyWav[39] = 0x61; // data
    view.setUint32(40, 0, true); // 0 data length

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "drums.wav",
        mimeType: "audio/wav",
        dataBase64: bytesToBase64(emptyWav),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      client.generateAsset("music", "drums", {
        model: "v1-fast",
        format: "WAV",
        durationSeconds: 20,
      })
    ).rejects.toThrow(/zero duration|zero audio samples/i);
  });

  it("persists generated audio into the local library preserving binary data and file details", async () => {
    const validWavBytes = createValidWavBinary(5);
    const audioBlob = new Blob([validWavBytes], { type: "audio/wav" });
    const audioFile = new File([audioBlob], "drums-loop.wav", { type: "audio/wav" });

    const storedAttachment = await repository.addFile(audioFile);
    expect(storedAttachment.name).toBe("drums-loop.wav");
    expect(storedAttachment.id).toBeTruthy();
    expect(storedAttachment.mimeType).toBe("audio/wav");

    const retrievedBlob = await repository.getFile(storedAttachment.id);
    expect(retrievedBlob).not.toBeNull();
    expect(retrievedBlob!.size).toBe(validWavBytes.length);

    const retrievedBuffer = await retrievedBlob!.arrayBuffer();
    const retrievedBytes = new Uint8Array(retrievedBuffer);
    expect(retrievedBytes[0]).toBe(0x52); // 'R'
    expect(retrievedBytes[1]).toBe(0x49); // 'I'
    expect(retrievedBytes[2]).toBe(0x46); // 'F'
    expect(retrievedBytes[3]).toBe(0x46); // 'F'
  });
});
