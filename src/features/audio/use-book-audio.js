import { useCallback, useState } from "react";
import { readAudioFile } from "./audio-files.js";
import { DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings } from "./audio-settings.js";

export function useBookAudio(setSaved) {
  const [audioSrc, setAudioSrc] = useState("");
  const [audioName, setAudioName] = useState("");
  const [audioAssetId, setAudioAssetId] = useState(null);
  const [audioSettings, setAudioSettings] = useState(DEFAULT_AUDIO_SETTINGS);
  const [audioError, setAudioError] = useState("");

  const loadBookAudio = useCallback((book = {}) => {
    setAudioSrc(book.audioSrc || "");
    setAudioName(book.audioName || "");
    setAudioAssetId(book.audioAssetId || null);
    setAudioSettings(normalizeAudioSettings(book.audioSettings));
    setAudioError("");
  }, []);

  const resetBookAudio = useCallback(() => {
    setAudioSrc("");
    setAudioName("");
    setAudioAssetId(null);
    setAudioSettings(DEFAULT_AUDIO_SETTINGS);
    setAudioError("");
  }, []);

  const pickBookAudio = useCallback(async (file) => {
    setAudioError("");
    try {
      const src = await readAudioFile(file);
      setAudioSrc(src);
      setAudioName(file.name);
      setAudioAssetId(null);
      setSaved(false);
      return true;
    } catch (error) {
      setAudioError(error?.message || "The audio file could not be loaded.");
      return false;
    }
  }, [setSaved]);

  return {
    audioSrc,
    audioName,
    audioAssetId,
    audioSettings,
    audioError,
    clearAudioError: useCallback(() => setAudioError(""), []),
    updateAudioSettings: useCallback((settings) => {
      setAudioSettings(normalizeAudioSettings(settings));
      setSaved(false);
    }, [setSaved]),
    loadBookAudio,
    resetBookAudio,
    pickBookAudio
  };
}
