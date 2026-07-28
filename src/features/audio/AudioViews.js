import { useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { formatAudioTime } from "./audio-files.js";

export function AudioBar({ audioSrc, audioName, onPick }) {
  const audio = useRef(null);
  const input = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playbackError, setPlaybackError] = useState("");

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setDuration(0);
    setPlaybackError("");
  }, [audioSrc]);

  const toggle = async () => {
    if (!audioSrc) return input.current?.click();
    if (!audio.current) return;
    if (!audio.current.paused) return audio.current.pause();
    setPlaybackError("");
    try {
      await audio.current.play();
    } catch {
      setPlaybackError("This recording could not be played. Try replacing it with another audio file.");
    }
  };

  return (
    <div className="audio-bar">
      <audio ref={audio} src={audioSrc || undefined}
        onTimeUpdate={() => setTime(audio.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(Number.isFinite(audio.current?.duration) ? audio.current.duration : 0)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => audioSrc && setPlaybackError("This recording could not be decoded by the browser.")} />
      <input ref={input} hidden type="file" accept="audio/*"
        onChange={(event) => event.target.files[0] && onPick(event.target.files[0])} />
      <button className="play-button" onClick={toggle} aria-label={playing ? "Pause recording" : audioSrc ? "Play recording" : "Add recording"}>
        {playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
      </button>
      <div className="track-copy">
        <strong>{audioName || "Add a companion recording"}</strong>
        <small>{playbackError || (audioSrc ? "Audio track" : "Optional · MP3, WAV or M4A")}</small>
      </div>
      <span className="time">{formatAudioTime(time)}</span>
      <input className="progress" aria-label="Recording position" type="range" min="0" max={duration || 100} value={time}
        onChange={(event) => { if (audio.current) audio.current.currentTime = +event.target.value; }} />
      <span className="time subtle">{formatAudioTime(duration)}</span>
      <button className="volume" aria-label={muted ? "Unmute recording" : "Mute recording"}
        onClick={() => { setMuted(!muted); if (audio.current) audio.current.muted = !muted; }}>
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </div>
  );
}

export function AudioEditor({ audioSrc, audioName, error, onPick }) {
  const input = useRef(null);
  return (
    <div className="editor-tab-content">
      <div className="panel-heading compact"><span className="eyebrow">COMPANION AUDIO</span><h1>Book recording</h1><p>Add one recording for the full book. Bookmark recordings remain separate.</p></div>
      <button className={`upload-tile ${audioSrc ? "filled" : ""}`} onClick={() => input.current?.click()}>
        <span className="upload-icon"><Headphones size={19} /></span>
        <span><strong>Companion recording</strong><small>{audioName || "MP3, WAV or M4A · up to 100 MB"}</small></span>
        <span className="tile-action">{audioSrc ? "Replace" : "Add"}</span>
        <input ref={input} hidden type="file" accept="audio/*"
          onChange={(event) => event.target.files[0] && onPick(event.target.files[0])} />
      </button>
      {error && <p className="field-error" role="alert">{error}</p>}
      {audioSrc && <div className="audio-file-card"><span><Headphones size={17} /></span><div><strong>{audioName}</strong><small>Loaded in the pinned player</small></div></div>}
      <div className="content-note"><Headphones size={16} /><p><strong>Piece-specific audio</strong><br />Attach recordings while creating bookmarks in Navigation.</p></div>
    </div>
  );
}
