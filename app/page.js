"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp,
  FileImage, GripVertical, Headphones, ImagePlus, Library, Loader2,
  Maximize2, Menu, Music2, Pause, Play, Plus, Rotate3D, Save, Sparkles,
  Trash2, Upload, Volume2, VolumeX, X
} from "lucide-react";

const SAMPLE_PAGES = [
  { id: "cover", name: "Cover", kind: "cover", src: "/cover.svg" },
  { id: "index", name: "Contents", kind: "index", src: "/index.svg" },
  { id: "page-1", name: "Moonlight I", kind: "page", src: "/sheet-1.svg" },
  { id: "page-2", name: "Moonlight II", kind: "page", src: "/sheet-2.svg" },
  { id: "page-3", name: "Moonlight III", kind: "page", src: "/sheet-3.svg" },
  { id: "page-4", name: "Moonlight IV", kind: "page", src: "/sheet-4.svg" },
];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("maestro-folio", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("books", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getBooks() {
  const db = await openDB();
  return new Promise((resolve) => {
    const req = db.transaction("books").objectStore("books").getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function putBook(book) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction("books", "readwrite");
    tx.objectStore("books").put(book);
    tx.oncomplete = resolve;
  });
}

async function removeBook(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction("books", "readwrite");
    tx.objectStore("books").delete(id);
    tx.oncomplete = resolve;
  });
}

const readFile = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(file);
});

function UploadTile({ icon: Icon, title, detail, accept, multiple, onFiles, filled }) {
  const input = useRef(null);
  return (
    <button className={`upload-tile ${filled ? "filled" : ""}`} onClick={() => input.current?.click()}>
      <span className="upload-icon">{filled ? <Check size={18} /> : <Icon size={19} />}</span>
      <span><strong>{title}</strong><small>{detail}</small></span>
      <span className="tile-action">{filled ? "Replace" : "Add"}</span>
      <input ref={input} hidden type="file" accept={accept} multiple={multiple}
        onChange={(e) => onFiles([...e.target.files])} />
    </button>
  );
}

function PageThumb({ page, index, active, onClick, onRemove }) {
  return (
    <div className={`page-thumb ${active ? "active" : ""}`} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}>
      <GripVertical className="grip" size={14} />
      <img src={page.src} alt={page.name} />
      <span>{index + 1}</span>
      <button className="thumb-remove" aria-label="Remove page" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
        <X size={12} />
      </button>
    </div>
  );
}

function BookStage({ pages, spread, tilt, setTilt, turning, setTurning, fullscreen, onFullscreen }) {
  const stage = useRef(null);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, rx: 0, ry: 0 });
  const totalSpreads = Math.max(1, Math.ceil((pages.length - 1) / 2));
  const safeSpread = Math.min(spread, totalSpreads);
  const leftIndex = safeSpread === 0 ? 0 : 1 + (safeSpread - 1) * 2;
  const rightIndex = safeSpread === 0 ? null : leftIndex + 1;
  const left = pages[leftIndex] || pages[0];
  const right = rightIndex !== null ? pages[rightIndex] : null;

  const down = (e) => {
    if (e.target.closest(".stage-button")) return;
    dragging.current = true;
    start.current = { x: e.clientX, y: e.clientY, rx: tilt.x, ry: tilt.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!dragging.current) return;
    setTilt({
      x: Math.max(-18, Math.min(18, start.current.rx - (e.clientY - start.current.y) * .08)),
      y: Math.max(-28, Math.min(28, start.current.ry + (e.clientX - start.current.x) * .1))
    });
  };
  const up = () => dragging.current = false;

  return (
    <div ref={stage} className={`book-stage ${fullscreen ? "stage-fullscreen" : ""}`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="stage-toolbar">
        <span><Rotate3D size={15} /> Drag to explore</span>
        <button className="stage-button" onClick={() => setTilt({ x: 7, y: -4 })}>Reset view</button>
        <button className="stage-button icon-only" onClick={onFullscreen}><Maximize2 size={15} /></button>
      </div>
      <div className="ambient-glow" />
      <div className={`book-wrap ${turning ? "is-turning" : ""}`}
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
        <div className="book-shadow" />
        <div className={`book ${right ? "open" : "closed"}`}>
          <div className="page-stack left-stack" style={{ "--stack": Math.min(14, leftIndex) }} />
          <div className="page-stack right-stack" style={{ "--stack": Math.min(14, pages.length - leftIndex) }} />
          <div className="book-page left-page">
            <img src={left?.src} alt={left?.name || "Book page"} />
            {safeSpread > 0 && <span className="page-no">{leftIndex}</span>}
          </div>
          {right && <div className="book-page right-page">
            <img src={right.src} alt={right.name} />
            <span className="page-no">{rightIndex}</span>
          </div>}
          {turning && <div className="turning-page"><div className="turning-front" /><div className="turning-back" /></div>}
          <div className="spine-shine" />
        </div>
      </div>
      <span className="stage-hint">Click the arrows or use your keyboard to turn pages</span>
    </div>
  );
}

function AudioBar({ audioSrc, audioName, onPick }) {
  const audio = useRef(null);
  const input = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const fmt = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, "0")}`;

  const toggle = () => {
    if (!audioSrc) return input.current?.click();
    if (audio.current.paused) audio.current.play(); else audio.current.pause();
  };
  return (
    <div className="audio-bar">
      <audio ref={audio} src={audioSrc || undefined}
        onTimeUpdate={() => setTime(audio.current.currentTime)}
        onLoadedMetadata={() => setDuration(audio.current.duration)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <input ref={input} hidden type="file" accept="audio/*" onChange={(e) => e.target.files[0] && onPick(e.target.files[0])} />
      <button className="play-button" onClick={toggle}>{playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</button>
      <div className="track-copy">
        <strong>{audioName || "Add a companion recording"}</strong>
        <small>{audioSrc ? "Audio track" : "Optional · MP3, WAV or M4A"}</small>
      </div>
      <span className="time">{fmt(time)}</span>
      <input className="progress" type="range" min="0" max={duration || 100} value={time}
        onChange={(e) => { if (audio.current) audio.current.currentTime = +e.target.value; }} />
      <span className="time subtle">{fmt(duration)}</span>
      <button className="volume" onClick={() => { setMuted(!muted); if (audio.current) audio.current.muted = !muted; }}>
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </div>
  );
}

function LibraryView({ books, onOpen, onDelete, onCreate }) {
  return (
    <main className="library-view">
      <div className="library-heading">
        <div><span className="eyebrow">YOUR COLLECTION</span><h1>Music worth returning to.</h1>
          <p>Every score, thoughtfully preserved and ready to play.</p></div>
        <button className="primary" onClick={onCreate}><Plus size={17} /> Create new book</button>
      </div>
      <div className="library-grid">
        {books.map((book) => (
          <article className="library-card" key={book.id}>
            <button className="cover-button" onClick={() => onOpen(book)}>
              <img src={book.pages?.[0]?.src || "/cover.svg"} alt={book.title} />
              <span className="open-pill"><BookOpen size={15} /> Open book</span>
            </button>
            <div className="card-copy">
              <div><h3>{book.title}</h3><p>{book.composer || "Unknown composer"}</p></div>
              <button className="delete-button" onClick={() => onDelete(book.id)}><Trash2 size={16} /></button>
            </div>
            <div className="card-meta"><span>{book.pages?.length || 0} pages</span><span>{book.audioSrc ? "With audio" : "Score only"}</span></div>
          </article>
        ))}
        <button className="new-card" onClick={onCreate}><span><Plus size={25} /></span><strong>Create a new book</strong><small>Bring another score to life</small></button>
      </div>
    </main>
  );
}

export default function Home() {
  const [mode, setMode] = useState("studio");
  const [pages, setPages] = useState(SAMPLE_PAGES);
  const [title, setTitle] = useState("Moonlight Sonata");
  const [composer, setComposer] = useState("Ludwig van Beethoven");
  const [spread, setSpread] = useState(1);
  const [tilt, setTilt] = useState({ x: 7, y: -4 });
  const [turning, setTurning] = useState(false);
  const [audioSrc, setAudioSrc] = useState("");
  const [audioName, setAudioName] = useState("");
  const [books, setBooks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const maxSpread = Math.max(0, Math.ceil((pages.length - 1) / 2));

  useEffect(() => { getBooks().then(setBooks).catch(() => {}); }, []);
  useEffect(() => {
    const key = (e) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const go = (delta) => {
    if (turning) return;
    const next = Math.max(0, Math.min(maxSpread, spread + delta));
    if (next === spread) return;
    setTurning(delta > 0 ? "next" : "prev");
    setTimeout(() => setSpread(next), 280);
    setTimeout(() => setTurning(false), 620);
  };

  const addImages = async (files, kind = "page") => {
    const mapped = await Promise.all(files.map(async (file, i) => ({
      id: `${Date.now()}-${i}`, name: file.name, kind, src: await readFile(file)
    })));
    if (kind === "cover") setPages((p) => [mapped[0], ...p.filter((x) => x.kind !== "cover")]);
    else if (kind === "index") {
      setPages((p) => {
        const noIndex = p.filter((x) => x.kind !== "index");
        return [noIndex[0], mapped[0], ...noIndex.slice(1)];
      });
    } else setPages((p) => [...p, ...mapped]);
    setSaved(false);
  };

  const pickAudio = async (file) => {
    setAudioSrc(await readFile(file));
    setAudioName(file.name);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    const book = {
      id: activeId || crypto.randomUUID(), title: title || "Untitled score", composer,
      pages, audioSrc, audioName, updatedAt: new Date().toISOString()
    };
    await putBook(book);
    setActiveId(book.id);
    setBooks(await getBooks());
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const openBook = (book) => {
    setPages(book.pages); setTitle(book.title); setComposer(book.composer || "");
    setAudioSrc(book.audioSrc || ""); setAudioName(book.audioName || "");
    setActiveId(book.id); setSpread(1); setMode("studio");
  };
  const createNew = () => {
    setPages(SAMPLE_PAGES); setTitle("Untitled score"); setComposer("");
    setAudioSrc(""); setAudioName(""); setActiveId(null); setSpread(1); setMode("studio");
  };
  const del = async (id) => { await removeBook(id); setBooks(await getBooks()); };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setMode("studio")}>
          <span className="brand-mark"><Music2 size={21} /></span>
          <span><strong>Maestro</strong><small>FOLIO</small></span>
        </button>
        <nav>
          <button className={mode === "studio" ? "active" : ""} onClick={() => setMode("studio")}><Sparkles size={16} /> Studio</button>
          <button className={mode === "library" ? "active" : ""} onClick={() => setMode("library")}><Library size={16} /> My library <span className="count">{books.length}</span></button>
        </nav>
        <div className="header-actions">
          <button className="help"><CircleHelp size={17} /> <span>Help</span></button>
          {mode === "studio" && <button className={`save-button ${saved ? "saved" : ""}`} onClick={save} disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} /> : saved ? <Check size={16} /> : <Save size={16} />}
            {saving ? "Saving" : saved ? "Saved" : "Save book"}
          </button>}
          <button className="avatar">LR</button>
        </div>
      </header>

      {mode === "library" ? <LibraryView books={books} onOpen={openBook} onDelete={del} onCreate={createNew} /> :
      <main className="workspace">
        <section className="editor-panel">
          <div className="panel-heading">
            <span className="eyebrow">BOOK DETAILS</span>
            <h1>Build your folio</h1>
            <p>Add your score, then arrange it exactly as you’d like.</p>
          </div>
          <label className="field"><span>Title</span><input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} /></label>
          <label className="field"><span>Composer</span><input value={composer} onChange={(e) => { setComposer(e.target.value); setSaved(false); }} /></label>
          <div className="divider" />
          <div className="section-title"><div><span className="eyebrow">BOOK CONTENT</span><h2>Pages</h2></div><span className="page-count">{pages.length} pages</span></div>
          <div className="upload-stack">
            <UploadTile icon={FileImage} title="Cover artwork" detail="JPG or PNG" accept="image/*" filled={pages.some(p => p.kind === "cover")} onFiles={(f) => addImages(f, "cover")} />
            <UploadTile icon={Menu} title="Index page" detail="Optional" accept="image/*" filled={pages.some(p => p.kind === "index")} onFiles={(f) => addImages(f, "index")} />
            <UploadTile icon={ImagePlus} title="Sheet music pages" detail="Select multiple pages" accept="image/*" multiple onFiles={(f) => addImages(f, "page")} />
          </div>
          <div className="thumb-heading"><span>Page order</span><small>Click to preview · drag coming soon</small></div>
          <div className="thumb-grid">
            {pages.map((page, i) => <PageThumb key={page.id} page={page} index={i} active={spread > 0 && (i === 1 + (spread - 1) * 2 || i === 2 + (spread - 1) * 2)}
              onClick={() => setSpread(i === 0 ? 0 : Math.ceil(i / 2))}
              onRemove={() => { setPages(pages.filter(x => x.id !== page.id)); setSpread(0); }} />)}
            <button className="add-thumb" onClick={() => document.querySelectorAll('input[type=file]')[2]?.click()}><Plus size={19} /><span>Add</span></button>
          </div>
          <div className="tip"><Headphones size={17} /><p><strong>Add a recording</strong><br />Pair the score with audio for practice or performance.</p></div>
        </section>

        <section className="preview-panel">
          <div className="preview-head">
            <div><span className="live-dot" /> LIVE PREVIEW</div>
            <div className="book-meta"><strong>{title}</strong><span>·</span><span>{pages.length} pages</span></div>
          </div>
          <BookStage pages={pages} spread={spread} tilt={tilt} setTilt={setTilt} turning={turning} setTurning={setTurning}
            fullscreen={fullscreen} onFullscreen={() => setFullscreen(!fullscreen)} />
          <div className="reader-controls">
            <button onClick={() => go(-1)} disabled={spread <= 0}><ChevronLeft size={21} /></button>
            <div><strong>{spread === 0 ? "Front cover" : `Pages ${1 + (spread - 1) * 2}–${Math.min(pages.length - 1, 2 + (spread - 1) * 2)}`}</strong>
              <small>{spread + 1} of {maxSpread + 1}</small></div>
            <button onClick={() => go(1)} disabled={spread >= maxSpread}><ChevronRight size={21} /></button>
          </div>
          <AudioBar audioSrc={audioSrc} audioName={audioName} onPick={pickAudio} />
        </section>
      </main>}
    </div>
  );
}
