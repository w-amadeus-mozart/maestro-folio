import { describe, expect, it } from "vitest";
import { formatAudioTime, MAX_AUDIO_BYTES, validateAudioFile } from "../src/features/audio/audio-files.js";

describe("audio file validation", () => {
  it("accepts browser-recognized audio files", () => {
    const file = { name: "rehearsal.mp3", type: "audio/mpeg", size: 1024 };
    expect(validateAudioFile(file)).toBe(file);
  });

  it("accepts a supported extension when the browser omits the MIME type", () => {
    const file = { name: "rehearsal.m4a", type: "", size: 1024 };
    expect(validateAudioFile(file)).toBe(file);
  });

  it("rejects unsupported formats", () => {
    expect(() => validateAudioFile({ name: "notes.txt", type: "text/plain", size: 20 }))
      .toThrow("Choose an MP3, WAV, M4A, AAC, OGG, or FLAC audio file.");
  });

  it("rejects files above the storage safety limit", () => {
    expect(() => validateAudioFile({ name: "concert.wav", type: "audio/wav", size: MAX_AUDIO_BYTES + 1 }))
      .toThrow("Audio files must be 100 MB or smaller.");
  });
});

describe("audio time formatting", () => {
  it("formats finite durations and safely handles invalid metadata", () => {
    expect(formatAudioTime(65.9)).toBe("1:05");
    expect(formatAudioTime(Infinity)).toBe("0:00");
    expect(formatAudioTime(-3)).toBe("0:00");
  });
});
