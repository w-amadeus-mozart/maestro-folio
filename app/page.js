"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark, BookmarkPlus, Check, CircleHelp,
  FileImage, FileText, GripVertical, Headphones, ImagePlus, Library, Loader2,
  Menu, Music2, Pause, Play, Plus, Save, Sparkles,
  Volume2, VolumeX, X
} from "lucide-react";

import {
  getStorageStatus,
  loadBook,
  revokeObjectUrls,
  saveBook
} from "../src/features/books/book-repository.js";
import { useBookLibrary } from "../src/features/books/use-book-library.js";
import { LibraryView } from "../src/features/library/LibraryView.js";
import { useBookmarks } from "../src/features/bookmarks/use-bookmarks.js";
import { BookmarkEditor, BookmarkModal, BookmarkSidebar } from "../src/features/bookmarks/BookmarkViews.js";
import { usePdfImport } from "../src/features/importer/use-pdf-import.js";
import { PdfImportModal } from "../src/features/importer/PdfImportModal.js";
import { useReaderNavigation } from "../src/features/reader/use-reader-navigation.js";
import { readerSpreadLabel } from "../src/features/reader/reader-geometry.js";
import { BookStage, ReaderControls } from "../src/features/reader/ReaderViews.js";
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

export default function Home() {
  const [mode, setMode] = useState("studio");
  const [pages, setPages] = useState(SAMPLE_PAGES);
  const [title, setTitle] = useState("Moonlight Sonata");
  const [composer, setComposer] = useState("Ludwig van Beethoven");
  const [audioSrc, setAudioSrc] = useState("");
  const [audioName, setAudioName] = useState("");
  const [audioAssetId, setAudioAssetId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [showPageNumbers, setShowPageNumbers] = useState(false);
  const [editorTab, setEditorTab] = useState("details");
  const [sideTab, setSideTab] = useState("pages");
  const loadedUrlsRef = useRef([]);
  const {
    books, importing, libraryError, transferNotice, clearLibraryMessages,
    refreshBooks, removeBook, exportBook, importBook
  } = useBookLibrary();
  const {
    spread, setSpread, tilt, setTilt, turning, fullscreen, maxSpread,
    go, jumpToPage, resetView, toggleFullscreen, closeFullscreen
  } = useReaderNavigation(pages.length);
  const {
    bookmarks, activeBookmarkId, activeBookmark, bookmarkDraft, resolveBookmarkSpread,
    resetBookmarks, clearActiveBookmark, openBookmarkCreator, closeBookmarkCreator,
    renameBookmarkDraft, attachBookmarkAudio, confirmBookmark, openBookmark,
    deleteBookmark, replaceActiveBookmarkAudio
  } = useBookmarks({ pages, spread, maxSpread, setSpread, setSaved });
  const acceptPdfImport = ({ pages: importedPages, fileName }) => {
    setPages(importedPages);
    setSpread(0);
    setSaved(false);
    setActiveId(null);
    resetBookmarks();
    revokeObjectUrls(loadedUrlsRef.current);
    loadedUrlsRef.current = [];
    if (!title || title === "Untitled score") setTitle(fileName.replace(/\.pdf$/i, ""));
  };
  const {
    pdfImport, beginPdfImport, chooseCover, chooseIndex, closePdfImport, confirmPdfImport
  } = usePdfImport(acceptPdfImport);
  const spreadLabel = (value) => readerSpreadLabel(value, pages.length);
  const navigateReader = (delta) => {
    if (go(delta)) clearActiveBookmark();
  };

  const applyLoadedBook = (book) => {
    revokeObjectUrls(loadedUrlsRef.current);
    loadedUrlsRef.current = book._objectUrls || [];
    setPages(book.pages); setTitle(book.title); setComposer(book.composer || "");
    setAudioSrc(book.audioSrc || ""); setAudioName(book.audioName || ""); setAudioAssetId(book.audioAssetId || null);
    setShowPageNumbers(Boolean(book.showPageNumbers));
    resetBookmarks(book.bookmarks || []);
    setActiveId(book.id); setSpread(1); setMode("studio");
  };

  useEffect(() => {
    return () => revokeObjectUrls(loadedUrlsRef.current);
  }, []);

  useEffect(() => {
    const key = (e) => {
      if (e.key === "ArrowRight") navigateReader(1);
      if (e.key === "ArrowLeft") navigateReader(-1);
      if (e.key === "Escape") closeFullscreen();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

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

  const pickPlayerAudio = async (file) => {
    if (!activeBookmark) return pickAudio(file);
    await replaceActiveBookmarkAudio(file);
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
    setSaveError(""); clearLibraryMessages();
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
    clearLibraryMessages();
    resetBookmarks();
  };

  const actionError = saveError || libraryError;
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

      {(actionError || storageWarning || transferNotice) && <div className={`storage-notice ${actionError ? "error" : transferNotice ? "success" : "warning"}`} role="alert">
        <div><strong>{actionError ? "Storage action failed" : transferNotice ? "Book transfer complete" : "Storage warning"}</strong><p>{actionError || transferNotice || storageWarning}</p></div>
        <button onClick={() => { setSaveError(""); setStorageWarning(""); clearLibraryMessages(); }} aria-label="Dismiss notification"><X size={15} /></button>
      </div>}
      {mode === "library" ? <LibraryView books={books} onOpen={openBook} onDelete={removeBook} onCreate={createNew}
        onExport={exportBook} onImport={importBook} importing={importing} /> :
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

            {editorTab === "navigation" && <BookmarkEditor
              bookmarks={bookmarks}
              activeBookmarkId={activeBookmarkId}
              currentLocation={spreadLabel(spread)}
              getBookmarkLocation={(bookmark) => spreadLabel(resolveBookmarkSpread(bookmark))}
              onAdd={openBookmarkCreator}
              onOpen={openBookmark}
              onDelete={deleteBookmark}
            />}
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
          <BookStage pages={pages} spread={spread} tilt={tilt} setTilt={setTilt} turning={turning}
            fullscreen={fullscreen} onFullscreen={toggleFullscreen} onResetView={resetView} showPageNumbers={showPageNumbers} />
          <ReaderControls spread={spread} maxSpread={maxSpread} label={spreadLabel(spread)}
            onPrevious={() => navigateReader(-1)} onNext={() => navigateReader(1)} />
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
                onClick={() => { jumpToPage(index); clearActiveBookmark(); }}>
                <img src={page.src} alt={page.name} /><span>{page.kind === "cover" ? "Cover" : page.kind === "index" ? "Index" : index}</span>
              </button>)}
            </div>
            <div className="side-panel-footer"><button onClick={() => { setEditorTab("content"); setTimeout(() => document.getElementById("sheet-pages-input")?.click(), 0); }}><Plus size={14} /> Add pages</button></div>
          </> : <BookmarkSidebar
            bookmarks={bookmarks}
            activeBookmarkId={activeBookmarkId}
            getBookmarkLocation={(bookmark) => spreadLabel(resolveBookmarkSpread(bookmark))}
            onAdd={openBookmarkCreator}
            onOpen={openBookmark}
          />}
        </aside>
      </main>}
      <BookmarkModal
        draft={bookmarkDraft}
        location={spreadLabel(bookmarkDraft?.spread ?? spread)}
        onNameChange={renameBookmarkDraft}
        onAudio={attachBookmarkAudio}
        onConfirm={confirmBookmark}
        onClose={closeBookmarkCreator}
      />      <PdfImportModal
        state={pdfImport}
        onChooseCover={chooseCover}
        onChooseIndex={chooseIndex}
        onConfirm={confirmPdfImport}
        onClose={closePdfImport}
      />    </div>
  );
}
