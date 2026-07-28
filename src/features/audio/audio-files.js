export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac"]);

export function validateAudioFile(file) {
  if (!file) throw new Error("Choose an audio file to continue.");

  const extension = file.name?.split(".").pop()?.toLowerCase();
  const hasAudioType = file.type?.startsWith("audio/");
  if (!hasAudioType && !AUDIO_EXTENSIONS.has(extension)) {
    throw new Error("Choose an MP3, WAV, M4A, AAC, OGG, or FLAC audio file.");
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error("Audio files must be 100 MB or smaller.");
  }
  return file;
}

export function readAudioFile(file) {
  validateAudioFile(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The audio file could not be read. Try another file."));
    reader.onabort = () => reject(new Error("Audio loading was cancelled."));
    reader.readAsDataURL(file);
  });
}

export function formatAudioTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(Math.floor(safeSeconds % 60)).padStart(2, "0")}`;
}
