"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bookmark, BookmarkPlus, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp,
  FileImage, FileText, GripVertical, Headphones, ImagePlus, Library, Loader2,
  Maximize2, Menu, Music2, Pause, Play, Plus, Rotate3D, Save, Sparkles,
  Trash2, Upload, Volume2, VolumeX, X
} from "lucide-react";

import {
  deleteBook,
  getStorageStatus,
  listBookSummaries,
  loadBook,
  revokeObjectUrls,
  saveBook
} from "../src/features/books/book-repository.js";
import { pageIdToSpread, spreadToPageId } from "../src/features/books/book-migrations.js";
const SAMPLE_PAGES = [
  { id: "cover", name: "Cover", kind: "cover", src: "/cover.svg" },
  { id: "index", name: "Contents", kind: "index", src: "/index.svg" },
  { id: "page-1", name: "Moonlight I", kind: "page", src: "/sheet-1.svg" },
  { id: "page-2", name: "Moonlight II", kind: "page", src: "/sheet-2.svg" },
  { id: "page-3", name: "Moonlight III", kind: "page", src: "/sheet-3.svg" },
  { id: "page-4", name: "Moonlight IV", kind: "page", src: "/sheet-4.svg" },
];

const readFile = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(file);
});

function UploadTile({ icon: Icon, title, detail, accept, multiple, onFiles, filled, inputId }) {
  const input = useRef(null);
  return (
    <button className={`upload-tile ${filled ? "filled" : ""}`} onClick={() => input.current?.click()}>
      <span className="upload-icon">{filled ? <Check size={18} /> : <Icon size={19} />}</span>
      <span><strong>{title}</strong><small>{detail}</small></span>
      <span className="tile-action">{filled ? "Replace" : "Add"}</span>
      <input ref={input} id={inputId} hidden type="file" accept={accept} multiple={multiple}
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

function BookStage({ pages, spread, tilt, setTilt, turning, setTurning, fullscreen, onFullscreen, showPageNumbers }) {
  const stage = useRef(null);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, rx: 0, ry: 0 });
  const [bookAspect, setBookAspect] = useState(1.414);
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
  const measurePage = (event) => {
    const image = event.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight) return;
    const spreadAspect = (image.naturalWidth / image.naturalHeight) * 2;
    setBookAspect(Math.max(1.1, Math.min(2.2, spreadAspect)));
  };

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
        style={{
          "--book-aspect": bookAspect,
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
        }}>
        <div className={`book ${right ? "open" : "closed"}`}>
          <div className="page-stack left-stack" style={{ "--stack": Math.min(14, leftIndex) }} />
          <div className="page-stack right-stack" style={{ "--stack": Math.min(14, pages.length - leftIndex) }} />
          <div className="book-page left-page">
            <img src={left?.src} alt={left?.name || "Book page"} onLoad={measurePage} />
            {showPageNumbers && safeSpread > 0 && <span className="page-no">{leftIndex}</span>}
          </div>
          {right && <div className="book-page right-page">
            <img src={right.src} alt={right.name} />
            {showPageNumbers && <span className="page-no">{rightIndex}</span>}
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
            <div className="card-meta"><span>{book.pageCount ?? book.pages?.length ?? 0} pages</span><span>{book.audioSrc ? "With audio" : "Score only"}</span></div>
          </article>
        ))}
        <button className="new-card" onClick={onCreate}><span><Plus size={25} /></span><strong>Create a new book</strong><small>Bring another score to life</small></button>
      </div>
    </main>
  );
}

function PdfImportModal({ state, setState, onConfirm, onClose }) {
  if (!state.open) return null;
  const chooseCover = (index) => setState((current) => ({
    ...current,
    frontIndex: index,
    indexIndex: current.indexIndex === index ? -1 : current.indexIndex
  }));
  const chooseIndex = (index) => setState((current) => ({ ...current, indexIndex: index }));

  return (
    <div className="pdf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Import PDF pages">
      <div className="pdf-modal">
        <div className="pdf-modal-head">
          <div>
            <span className="eyebrow">IMPORT PDF</span>
            <h2>{state.status === "loading" ? "Preparing your score" : "Choose your book pages"}</h2>
            <p>{state.fileName}</p>
          </div>
          <button className="pdf-close" onClick={onClose} aria-label="Close PDF import"><X size={18} /></button>
        </div>
        {state.status === "loading" ? (
          <div className="pdf-loading">
            <span className="pdf-loader"><Loader2 className="spin" size={26} /></span>
            <strong>Rendering page {state.progress || 1}</strong>
            <p>Creating clear previews from your PDF. Large scores may take a moment.</p>
          </div>
        ) : state.status === "error" ? (
          <div className="pdf-error"><strong>We couldn’t read this PDF.</strong><p>{state.error}</p></div>
        ) : (
          <>
            <div className="pdf-role-controls">
              <label><span>Front cover</span>
                <select value={state.frontIndex} onChange={(e) => chooseCover(Number(e.target.value))}>
                  {state.pages.map((_, index) => <option key={index} value={index}>PDF page {index + 1}</option>)}
                </select>
              </label>
              <label><span>Index page</span>
                <select value={state.indexIndex} onChange={(e) => setState((current) => ({ ...current, indexIndex: Number(e.target.value) }))}>
                  <option value={-1}>No index page</option>
                  {state.pages.map((_, index) => index !== state.frontIndex && <option key={index} value={index}>PDF page {index + 1}</option>)}
                </select>
              </label>
              <p>The remaining {Math.max(0, state.pages.length - 1 - (state.indexIndex >= 0 ? 1 : 0))} pages will become sheet music.</p>
            </div>
            <div className="pdf-page-grid">
              {state.pages.map((page, index) => {
                const isCover = state.frontIndex === index;
                const isIndex = state.indexIndex === index;
                return (
                  <article className={`pdf-page-card ${isCover ? "is-cover" : ""} ${isIndex ? "is-index" : ""}`} key={page.id}>
                    <div className="pdf-page-image"><img src={page.src} alt={`PDF page ${index + 1}`} /><span>Page {index + 1}</span></div>
                    <div className="pdf-page-actions">
                      <button className={isCover ? "selected" : ""} onClick={() => chooseCover(index)}>{isCover && <Check size={12} />} Cover</button>
                      <button className={isIndex ? "selected" : ""} disabled={isCover} onClick={() => chooseIndex(index)}>{isIndex && <Check size={12} />} Index</button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="pdf-modal-footer">
              <button className="pdf-cancel" onClick={onClose}>Cancel</button>
              <button className="primary" onClick={onConfirm}><BookOpen size={16} /> Import {state.pages.length} pages</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function BookmarkModal({ draft, setDraft, location, onConfirm, onClose, onAudio }) {
  const audioInput = useRef(null);
  if (!draft) return null;
  return (
    <div className="bookmark-modal-backdrop" role="dialog" aria-modal="true" aria-label="Add bookmark">
      <div className="bookmark-modal">
        <div className="bookmark-modal-icon"><BookmarkPlus size={23} /></div>
        <button className="bookmark-modal-close" onClick={onClose} aria-label="Close"><X size={17} /></button>
        <span className="eyebrow">NEW BOOKMARK</span>
        <h2>Name this piece</h2>
        <p className="bookmark-location"><Bookmark size={13} /> {location}</p>
        <label className="field"><span>Bookmark name</span>
          <input autoFocus value={draft.name} placeholder="e.g. Piece 10 · Amazing Grace"
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <div className="bookmark-audio-field">
          <div><span>Audio file · optional</span><strong>{draft.audioName || "No recording attached"}</strong><small>MP3, WAV or M4A</small></div>
          <button onClick={() => audioInput.current?.click()}><Headphones size={15} /> {draft.audioSrc ? "Replace" : "Choose audio"}</button>
          <input ref={audioInput} hidden type="file" accept="audio/*" onChange={(event) => event.target.files[0] && onAudio(event.target.files[0])} />
        </div>
        <div className="bookmark-modal-actions">
          <button className="pdf-cancel" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!draft.name.trim()} onClick={onConfirm}><BookmarkPlus size={16} /> Add bookmark</button>
        </div>
      </div>
    </div>
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
  const [audioAssetId, setAudioAssetId] = useState(null);
  const [books, setBooks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showPageNumbers, setShowPageNumbers] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [activeBookmarkId, setActiveBookmarkId] = useState(null);
  const [bookmarkDraft, setBookmarkDraft] = useState(null);
  const [editorTab, setEditorTab] = useState("details");
  const [sideTab, setSideTab] = useState("pages");
  const [pdfImport, setPdfImport] = useState({ open: false, status: "idle", pages: [], frontIndex: 0, indexIndex: -1, progress: 0 });
  const loadedUrlsRef = useRef([]);
  const summaryUrlsRef = useRef([]);
  const maxSpread = Math.max(0, Math.ceil((pages.length - 1) / 2));
  const activeBookmark = bookmarks.find((bookmark) => bookmark.id === activeBookmarkId) || null;
  const resolveBookmarkSpread = (bookmark) => {
    if (!bookmark) return null;
    if (bookmark.pageId) return pageIdToSpread(bookmark.pageId, pages);
    return bookmark.spread ?? null;
  };
  const spreadLabel = (value) => value === null ? "Page removed" : value === 0 ? "Front cover" : `Pages ${1 + (value - 1) * 2}–${Math.min(pages.length - 1, 2 + (value - 1) * 2)}`;

  const refreshBooks = async () => {
    const result = await listBookSummaries();
    revokeObjectUrls(summaryUrlsRef.current);
    summaryUrlsRef.current = result.objectUrls;
    setBooks(result.books);
  };

  const applyLoadedBook = (book) => {
    revokeObjectUrls(loadedUrlsRef.current);
    loadedUrlsRef.current = book._objectUrls || [];
    setPages(book.pages); setTitle(book.title); setComposer(book.composer || "");
    setAudioSrc(book.audioSrc || ""); setAudioName(book.audioName || ""); setAudioAssetId(book.audioAssetId || null);
    setShowPageNumbers(Boolean(book.showPageNumbers));
    setBookmarks(book.bookmarks || []); setActiveBookmarkId(null);
    setActiveId(book.id); setSpread(1); setMode("studio");
  };

  useEffect(() => {
    refreshBooks().catch((error) => setSaveError(error.message));
    return () => {
      revokeObjectUrls(loadedUrlsRef.current);
      revokeObjectUrls(summaryUrlsRef.current);
    };
  }, []);

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
    setActiveBookmarkId(null);
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

  const beginPdfImport = async (files) => {
    const file = files[0];
    if (!file) return;
    setPdfImport({ open: true, status: "loading", fileName: file.name, pages: [], frontIndex: 0, indexIndex: -1, progress: 1 });
    try {
      const [pdfjs, workerModule] = await Promise.all([
        import("pdfjs-dist/build/pdf.mjs"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const rendered = [];
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        setPdfImport((current) => ({ ...current, progress: pageNumber }));
        const pdfPage = await pdfDocument.getPage(pageNumber);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(2, 1400 / baseViewport.width);
        const viewport = pdfPage.getViewport({ scale });
        const canvas = globalThis.document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        rendered.push({
          id: `pdf-${Date.now()}-${pageNumber}`,
          name: `${file.name} · page ${pageNumber}`,
          originalPage: pageNumber,
          src: canvas.toDataURL("image/jpeg", 0.9)
        });
        pdfPage.cleanup();
      }
      setPdfImport({
        open: true, status: "ready", fileName: file.name, pages: rendered,
        frontIndex: 0, indexIndex: rendered.length > 1 ? 1 : -1, progress: rendered.length
      });
    } catch (error) {
      setPdfImport((current) => ({ ...current, status: "error", error: error?.message || "Please try a different PDF file." }));
    }
  };

  const confirmPdfImport = () => {
    const cover = pdfImport.pages[pdfImport.frontIndex];
    if (!cover) return;
    const index = pdfImport.indexIndex >= 0 ? pdfImport.pages[pdfImport.indexIndex] : null;
    const selected = new Set([pdfImport.frontIndex, pdfImport.indexIndex]);
    const musicPages = pdfImport.pages.filter((_, position) => !selected.has(position));
    setPages([
      { ...cover, kind: "cover", name: `${cover.name} · cover` },
      ...(index ? [{ ...index, kind: "index", name: `${index.name} · index` }] : []),
      ...musicPages.map((page) => ({ ...page, kind: "page" }))
    ]);
    setSpread(0);
    setSaved(false);
    setActiveId(null);
    setBookmarks([]); setActiveBookmarkId(null);
    revokeObjectUrls(loadedUrlsRef.current); loadedUrlsRef.current = [];
    if (!title || title === "Untitled score") setTitle(pdfImport.fileName.replace(/\.pdf$/i, ""));
    setPdfImport((current) => ({ ...current, open: false }));
  };
  const openBookmarkCreator = () => {
    setBookmarkDraft({
      id: crypto.randomUUID(),
      name: `Piece ${bookmarks.length + 1}`,
      pageId: spreadToPageId(spread, pages),
      spread,
      audioSrc: "",
      audioName: ""
    });
  };

  const attachBookmarkAudio = async (file) => {
    const src = await readFile(file);
    setBookmarkDraft((current) => ({ ...current, audioSrc: src, audioName: file.name }));
  };

  const confirmBookmark = () => {
    if (!bookmarkDraft?.name.trim()) return;
    const bookmark = { ...bookmarkDraft, name: bookmarkDraft.name.trim() };
    setBookmarks((current) => [...current, bookmark]);
    setActiveBookmarkId(bookmark.id);
    setBookmarkDraft(null);
    setSaved(false);
  };

  const openBookmark = (bookmark) => {
    const destination = resolveBookmarkSpread(bookmark);
    if (destination === null) return;
    setSpread(Math.max(0, Math.min(maxSpread, destination)));
    setActiveBookmarkId(bookmark.id);
  };

  const deleteBookmark = (id) => {
    setBookmarks((current) => current.filter((bookmark) => bookmark.id !== id));
    if (activeBookmarkId === id) setActiveBookmarkId(null);
    setSaved(false);
  };

  const pickPlayerAudio = async (file) => {
    if (!activeBookmark) return pickAudio(file);
    const src = await readFile(file);
    setBookmarks((current) => current.map((bookmark) => bookmark.id === activeBookmark.id
      ? { ...bookmark, audioSrc: src, audioName: file.name, audioAssetId: null }
      : bookmark));
    setSaved(false);
  };
  const pickAudio = async (file) => {
    setAudioSrc(await readFile(file));
    setAudioName(file.name);
    setAudioAssetId(null);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true); setSaveError(""); setStorageWarning("");
    const bookId = activeId || crypto.randomUUID();
    try {
      await saveBook({
        id: bookId, title: title || "Untitled score", composer,
        pages, audioSrc, audioName, audioAssetId, showPageNumbers, bookmarks,
        updatedAt: new Date().toISOString()
      });
      const hydrated = await loadBook(bookId);
      applyLoadedBook(hydrated);
      await refreshBooks();
      const storage = await getStorageStatus();
      if (storage.ratio > 0.8) setStorageWarning(`Browser storage is ${Math.round(storage.ratio * 100)}% full. Export or remove books soon.`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      setSaveError(error?.message || "The book could not be saved. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  const openBook = async (summary) => {
    setSaveError("");
    try {
      const book = await loadBook(summary.id);
      applyLoadedBook(book);
    } catch (error) {
      setSaveError(error?.message || "The book could not be opened.");
    }
  };
  const createNew = () => {
    revokeObjectUrls(loadedUrlsRef.current); loadedUrlsRef.current = [];
    setPages(SAMPLE_PAGES); setTitle("Untitled score"); setComposer("");
    setAudioSrc(""); setAudioName(""); setAudioAssetId(null); setActiveId(null); setSpread(1); setMode("studio");
    setShowPageNumbers(false); setSaveError(""); setStorageWarning("");
    setBookmarks([]); setActiveBookmarkId(null); setBookmarkDraft(null);
  };
  const del = async (id) => {
    try {
      await deleteBook(id);
      await refreshBooks();
    } catch (error) {
      setSaveError(error?.message || "The book could not be deleted.");
    }
  };

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

      {(saveError || storageWarning) && <div className={`storage-notice ${saveError ? "error" : "warning"}`} role="alert">
        <div><strong>{saveError ? "Storage action failed" : "Storage warning"}</strong><p>{saveError || storageWarning}</p></div>
        <button onClick={() => { setSaveError(""); setStorageWarning(""); }} aria-label="Dismiss notification"><X size={15} /></button>
      </div>}
      {mode === "library" ? <LibraryView books={books} onOpen={openBook} onDelete={del} onCreate={createNew} /> :
      <main className="workspace">
        <section className="editor-panel">
          <div className="editor-titlebar">
            <div><span className="eyebrow">BOOK SETUP</span><strong>{title || "Untitled score"}</strong></div>
            <span>{pages.length} pages</span>
          </div>
          <div className="editor-tabs" role="tablist">
            <button className={editorTab === "details" ? "active" : ""} onClick={() => setEditorTab("details")}>Details</button>
            <button className={editorTab === "content" ? "active" : ""} onClick={() => setEditorTab("content")}>Content</button>
            <button className={editorTab === "audio" ? "active" : ""} onClick={() => setEditorTab("audio")}>Audio</button>
            <button className={editorTab === "navigation" ? "active" : ""} onClick={() => setEditorTab("navigation")}>Navigation</button>
          </div>
          <div className="editor-scroll">
            {editorTab === "details" && <div className="editor-tab-content">
              <div className="panel-heading compact"><span className="eyebrow">BOOK DETAILS</span><h1>Book setup</h1><p>Name your score and choose its display options.</p></div>
              <label className="field"><span>Title</span><input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} /></label>
              <label className="field"><span>Composer</span><input value={composer} onChange={(e) => { setComposer(e.target.value); setSaved(false); }} /></label>
              <div className="section-rule"><span>DISPLAY OPTIONS</span></div>
              <div className="book-option tab-option">
                <div><strong>Display page numbers</strong><small>Turn off for scores that already include them.</small></div>
                <button className={`switch ${showPageNumbers ? "on" : ""}`} role="switch" aria-checked={showPageNumbers}
                  onClick={() => { setShowPageNumbers(!showPageNumbers); setSaved(false); }}><span /></button>
              </div>
              <div className="detected-size"><span>Detected page shape</span><strong>Automatic from upload</strong><small>The 3D book follows each page’s original proportions.</small></div>
            </div>}

            {editorTab === "content" && <div className="editor-tab-content">
              <div className="section-title"><div><span className="eyebrow">BOOK CONTENT</span><h2>Pages & files</h2></div><span className="page-count">{pages.length} pages</span></div>
              <div className="upload-stack">
                <UploadTile icon={FileImage} title="Cover artwork" detail="JPG or PNG" accept="image/*" filled={pages.some(p => p.kind === "cover")} onFiles={(f) => addImages(f, "cover")} />
                <UploadTile icon={Menu} title="Index page" detail="Optional" accept="image/*" filled={pages.some(p => p.kind === "index")} onFiles={(f) => addImages(f, "index")} />
                <UploadTile inputId="sheet-pages-input" icon={ImagePlus} title="Sheet music pages" detail="Select multiple images" accept="image/*" multiple onFiles={(f) => addImages(f, "page")} />
                <UploadTile inputId="pdf-import-input" icon={FileText} title="Import complete PDF" detail="Choose cover and index after upload" accept="application/pdf,.pdf" onFiles={beginPdfImport} />
              </div>
              <div className="content-note"><FileText size={16} /><p><strong>PDF import keeps page order.</strong><br />Choose the cover and index after the file is rendered.</p></div>
            </div>}

            {editorTab === "audio" && <div className="editor-tab-content">
              <div className="panel-heading compact"><span className="eyebrow">COMPANION AUDIO</span><h1>Book recording</h1><p>Add one recording for the full book. Bookmark recordings remain separate.</p></div>
              <UploadTile icon={Headphones} title="Companion recording" detail={audioName || "MP3, WAV or M4A"} accept="audio/*" filled={Boolean(audioSrc)} onFiles={(files) => files[0] && pickAudio(files[0])} />
              {audioSrc && <div className="audio-file-card"><span><Headphones size={17} /></span><div><strong>{audioName}</strong><small>Loaded in the pinned player</small></div></div>}
              <div className="content-note"><Bookmark size={16} /><p><strong>Piece-specific audio</strong><br />Attach recordings while creating bookmarks in Navigation.</p></div>
            </div>}

            {editorTab === "navigation" && <div className="editor-tab-content">
              <div className="bookmark-heading">
                <div><span className="eyebrow">NAVIGATION</span><h3>Bookmarks</h3></div>
                <button onClick={openBookmarkCreator}><BookmarkPlus size={14} /> Add</button>
              </div>
              <p className="bookmark-current">Current location: <strong>{spreadLabel(spread)}</strong></p>
              {bookmarks.length === 0 ? <div className="bookmark-empty"><Bookmark size={18} /><span>No bookmarks yet</span><small>Save a cover, index, or named piece.</small></div> :
              <div className="bookmark-list">{bookmarks.map((bookmark) => <article className={`bookmark-row ${activeBookmarkId === bookmark.id ? "active" : ""}`} key={bookmark.id}>
                <button className="bookmark-open" onClick={() => openBookmark(bookmark)}><span className="bookmark-pin"><Bookmark size={14} fill="currentColor" /></span><span><strong>{bookmark.name}</strong><small>{spreadLabel(resolveBookmarkSpread(bookmark))}{bookmark.audioName ? ` · ${bookmark.audioName}` : " · No audio"}</small></span></button>
                <button className="bookmark-delete" onClick={() => deleteBookmark(bookmark.id)} aria-label={`Delete ${bookmark.name}`}><Trash2 size={13} /></button>
              </article>)}</div>}
            </div>}
          </div>
          <div className="quick-actions">
            <button onClick={() => { setEditorTab("content"); setTimeout(() => document.getElementById("pdf-import-input")?.click(), 0); }}><FileText size={14} /> Import PDF</button>
            <button onClick={openBookmarkCreator}><BookmarkPlus size={14} /> Bookmark here</button>
          </div>
        </section>

        <section className="preview-panel">
          <div className="preview-head">
            <div><span className="live-dot" /> 3D BOOK PREVIEW</div>
            <div className="book-meta"><strong>{title}</strong><span>·</span><span>{spreadLabel(spread)}</span></div>
          </div>
          <BookStage pages={pages} spread={spread} tilt={tilt} setTilt={setTilt} turning={turning} setTurning={setTurning}
            fullscreen={fullscreen} onFullscreen={() => setFullscreen(!fullscreen)} showPageNumbers={showPageNumbers} />
          <div className="reader-controls">
            <button onClick={() => go(-1)} disabled={spread <= 0}><ChevronLeft size={21} /></button>
            <div><strong>{spreadLabel(spread)}</strong><small>{spread + 1} of {maxSpread + 1}</small></div>
            <button onClick={() => go(1)} disabled={spread >= maxSpread}><ChevronRight size={21} /></button>
          </div>
          <AudioBar key={activeBookmark?.id || "book-audio"} audioSrc={activeBookmark ? activeBookmark.audioSrc : audioSrc}
            audioName={activeBookmark ? `${activeBookmark.name}${activeBookmark.audioName ? ` · ${activeBookmark.audioName}` : " · No audio attached"}` : audioName} onPick={pickPlayerAudio} />
        </section>

        <aside className="side-panel">
          <div className="side-tabs">
            <button className={sideTab === "pages" ? "active" : ""} onClick={() => setSideTab("pages")}><FileImage size={14} /> Pages</button>
            <button className={sideTab === "bookmarks" ? "active" : ""} onClick={() => setSideTab("bookmarks")}><Bookmark size={14} /> Bookmarks <span>{bookmarks.length}</span></button>
          </div>
          {sideTab === "pages" ? <>
            <div className="side-panel-head"><span>ALL PAGES ({pages.length})</span><small>Quick jump</small></div>
            <div className="side-page-grid">
              {pages.map((page, index) => <button key={page.id} className={(spread === 0 && index === 0) || (spread > 0 && (index === 1 + (spread - 1) * 2 || index === 2 + (spread - 1) * 2)) ? "active" : ""}
                onClick={() => { setSpread(index === 0 ? 0 : Math.ceil(index / 2)); setActiveBookmarkId(null); }}>
                <img src={page.src} alt={page.name} /><span>{page.kind === "cover" ? "Cover" : page.kind === "index" ? "Index" : index}</span>
              </button>)}
            </div>
            <div className="side-panel-footer"><button onClick={() => { setEditorTab("content"); setTimeout(() => document.getElementById("sheet-pages-input")?.click(), 0); }}><Plus size={14} /> Add pages</button></div>
          </> : <>
            <div className="side-panel-head"><span>BOOKMARKS ({bookmarks.length})</span><button onClick={openBookmarkCreator}><Plus size={13} /> Add here</button></div>
            <div className="side-bookmark-list">
              {bookmarks.length === 0 ? <div className="side-empty"><Bookmark size={21} /><strong>No bookmarks</strong><small>Navigate to a page and add one.</small></div> : bookmarks.map((bookmark) =>
                <button key={bookmark.id} className={activeBookmarkId === bookmark.id ? "active" : ""} onClick={() => openBookmark(bookmark)}>
                  <span><Bookmark size={14} fill="currentColor" /></span><div><strong>{bookmark.name}</strong><small>{spreadLabel(resolveBookmarkSpread(bookmark))}{bookmark.audioName ? " · Audio" : ""}</small></div><ChevronRight size={14} />
                </button>)}
            </div>
          </>}
        </aside>
      </main>}
      <BookmarkModal
        draft={bookmarkDraft}
        setDraft={setBookmarkDraft}
        location={spreadLabel(bookmarkDraft?.spread ?? spread)}
        onAudio={attachBookmarkAudio}
        onConfirm={confirmBookmark}
        onClose={() => setBookmarkDraft(null)}
      />      <PdfImportModal
        state={pdfImport}
        setState={setPdfImport}
        onConfirm={confirmPdfImport}
        onClose={() => setPdfImport((current) => ({ ...current, open: false }))}
      />    </div>
  );
}
