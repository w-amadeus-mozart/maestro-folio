import { useCallback, useState } from "react";
import { readAudioFile } from "./audio-files.js";

export function useBookAudio(setSaved) {
  const [audioSrc, setAudioSrc] = useState("");
  const [audioName, setAudioName] = useState("");
  const [audioAssetId, setAudioAssetId] = useState(null);
  const [audioError, setAudioError] = useState("");

  const loadBookAudio = useCallback((book = {}) => {
    setAudioSrc(book.audioSrc || "");
    setAudioName(book.audioName || "");
    setAudioAssetId(book.audioAssetId || null);
    setAudioError("");
  }, []);

  const resetBookAudio = useCallback(() => {
    setAudioSrc("");
    setAudioName("");
    setAudioAssetId(null);
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
    audioError,
    clearAudioError: useCallback(() => setAudioError(""), []),
    loadBookAudio,
    resetBookAudio,
    pickBookAudio
  };
}
