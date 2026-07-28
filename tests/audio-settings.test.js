import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUDIO_SETTINGS,
  effectiveLoopRange,
  normalizeAudioSettings
} from "../src/features/audio/audio-settings.js";

describe("audio practice settings", () => {
  it("provides safe defaults and clamps playback speed", () => {
    expect(normalizeAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(normalizeAudioSettings({ playbackRate: 8 }).playbackRate).toBe(2);
    expect(normalizeAudioSettings({ playbackRate: 0.1 }).playbackRate).toBe(0.5);
  });

  it("uses track duration for an unset loop end", () => {
    expect(effectiveLoopRange({ loopEnabled: true, loopStart: 12 }, 30)).toEqual({ start: 12, end: 30 });
  });

  it("rejects empty and reversed loop ranges", () => {
    expect(effectiveLoopRange({ loopEnabled: true, loopStart: 20, loopEnd: 10 }, 30)).toBeNull();
    expect(effectiveLoopRange({ loopEnabled: false, loopStart: 2, loopEnd: 5 }, 30)).toBeNull();
  });
});
