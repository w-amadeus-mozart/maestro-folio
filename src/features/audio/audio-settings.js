export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  playbackRate: 1,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: null
});

export function normalizeAudioSettings(settings = {}) {
  const playbackRate = Number(settings.playbackRate);
  const loopStart = Number(settings.loopStart);
  const loopEnd = settings.loopEnd === null || settings.loopEnd === undefined
    ? null
    : Number(settings.loopEnd);

  return {
    playbackRate: Number.isFinite(playbackRate)
      ? Math.max(0.5, Math.min(2, playbackRate))
      : DEFAULT_AUDIO_SETTINGS.playbackRate,
    loopEnabled: Boolean(settings.loopEnabled),
    loopStart: Number.isFinite(loopStart) ? Math.max(0, loopStart) : 0,
    loopEnd: Number.isFinite(loopEnd) ? Math.max(0, loopEnd) : null
  };
}

export function effectiveLoopRange(settings, duration) {
  const normalized = normalizeAudioSettings(settings);
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const start = Math.min(normalized.loopStart, safeDuration);
  const end = Math.min(normalized.loopEnd ?? safeDuration, safeDuration);
  return normalized.loopEnabled && end > start ? { start, end } : null;
}
