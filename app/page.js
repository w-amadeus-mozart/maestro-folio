"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark, BookmarkPlus, Check, CircleHelp,
  FileImage, FileText, ImagePlus, Library, Loader2,
  Menu, Music2, Plus, Save, Sparkles, X
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
import { readImageFiles } from "../src/features/importer/upload-files.js";
import { useReaderNavigation } from "../src/features/reader/use-reader-navigation.js";
import { readerSpreadLabel } from "../src/features/reader/reader-geometry.js";
import { BookStage, ReaderControls } from "../src/features/reader/ReaderViews.js";
import { useBookAudio } from "../src/features/audio/use-book-audio.js";
import { AudioBar, AudioEditor } from "../src/features/audio/AudioViews.js";
import { PageGrid } from "../src/features/pages/PageGrid.js";
import { movePage } from "../src/features/pages/page-order.js";
import { DEFAULT_PAGE_NUMBERING, normalizePageNumbering } from "../src/features/pages/page-numbering.js";
import { PageNumberingControls } from "../src/features/pages/PageNumberingControls.js";
import { pageIdToSpread, spreadToPageId } from "../src/features/books/book-migrations.js";
const SAMPLE_PAGES = [
  { id: "cover", name: "Cover", kind: "cover", src: "/cover.svg" },
  { id: "index", name: "Contents", kind: "index", src: "/index.svg" },
  { id: "page-1", name: "Moonlight I", kind: "page", src: "/sheet-1.svg" },
  { id: "page-2", name: "Moonlight II", kind: "page", src: "/sheet-2.svg" },
  { id: "page-3", name: "Moonlight III", kind: "page", src: "/sheet-3.svg" },
  { id: "page-4", name: "Moonlight IV", kind: "page", src: "/sheet-4.svg" },
];

function UploadTile({ icon: Icon, title, detail, accept, multiple, onFiles, filled, inputId }) {
  const input = useRef(null);
  return (
    <>
      <button className={`upload-tile ${filled ? "filled" : ""}`} onClick={() => input.current?.click()}>
        <span className="upload-icon">{filled ? <Check size={18} /> : <Icon size={19} />}</span>
        <span><strong>{title}</strong><small>{detail}</small></span>
        <span className="tile-action">{filled ? "Replace" : "Add"}</span>
      </button>
      <input ref={input} id={inputId} hidden type="file" accept={accept} multiple={multiple}
        onChange={(event) => {
          const files = [...event.target.files];
          event.target.value = "";
          onFiles(files);
        }} />
    </>
  );
}

const EDITOR_TABS = ["details", "content", "audio", "navigation"];
const SIDE_TABS = ["pages", "bookmarks"];

function moveTabFocus(event, tabs, setActive) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const current = tabs.indexOf(event.currentTarget.dataset.tab);
  const next = event.key === "Home" ? 0
    : event.key === "End" ? tabs.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  setActive(tabs[next]);
  event.currentTarget.parentElement?.querySelector(`[data-tab="${tabs[next]}"]`)?.focus();
}

export default function Home() {
  const [mode, setMode] = useState("studio");
  const [pages, setPages] = useState(SAMPLE_PAGES);
  const [title, setTitle] = useState("Moonlight Sonata");
  const [composer, setComposer] = useState("Ludwig van Beethoven");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [pageNumbering, setPageNumbering] = useState(DEFAULT_PAGE_NUMBERING);
  const [editorTab, setEditorTab] = useState("details");
  const [sideTab, setSideTab] = useState("pages");
  const loadedUrlsRef = useRef([]);
  const {
    audioSrc, audioName, audioAssetId, audioError,
    loadBookAudio, resetBookAudio, pickBookAudio
  } = useBookAudio(setSaved);
  const {
    books, importing, libraryError, transferNotice, clearLibraryMessages,
    refreshBooks, removeBook, exportBook, importBook
  } = useBookLibrary();
  const {
    spread, setSpread, tilt, setTilt, turning, fullscreen, maxSpread,
    go, jumpToPage, resetView, toggleFullscreen, closeFullscreen
  } = useReaderNavigation(pages.length);
  const {
    bookmarks, activeBookmarkId, activeBookmark, bookmarkDraft, bookmarkAudioError, resolveBookmarkSpread,
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
  const reorderPages = (fromIndex, toIndex) => {
    const visiblePageIds = spread === 0 ? [pages[0]?.id] : [
      pages[1 + (spread - 1) * 2]?.id,
      pages[2 + (spread - 1) * 2]?.id
    ].filter(Boolean);
    const movedPageId = pages[fromIndex]?.id;
    const activePageId = visiblePageIds.includes(movedPageId)
      ? movedPageId
      : spreadToPageId(spread, pages);
    const reordered = movePage(pages, fromIndex, toIndex);
    if (reordered === pages) return;
    setPages(reordered);
    setSpread(pageIdToSpread(activePageId, reordered) ?? 0);
    setSaved(false);
  };

  const applyLoadedBook = (book) => {
    revokeObjectUrls(loadedUrlsRef.current);
    loadedUrlsRef.current = book._objectUrls || [];
    setPages(book.pages); setTitle(book.title); setComposer(book.composer || "");
    loadBookAudio(book);
    setPageNumbering(normalizePageNumbering(book.pageNumbering, book.showPageNumbers));
    resetBookmarks(book.bookmarks || []);
    setActiveId(book.id); setSpread(1); setMode("studio");
  };

  useEffect(() => {
    return () => revokeObjectUrls(loadedUrlsRef.current);
  }, []);

  useEffect(() => {
    const key = (e) => {
      if (document.querySelector("[aria-modal='true']")) return;
      if (e.target.closest("button, input, textarea, select, [role='tab'], [contenteditable='true']")) return;
      if (e.key === "ArrowRight") navigateReader(1);
      if (e.key === "ArrowLeft") navigateReader(-1);
      if (e.key === "Escape") closeFullscreen();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const addImages = async (files, kind = "page") => {
    setUploadError("");
    try {
      const decoded = await readImageFiles(files);
      const mapped = decoded.map(({ file, src }, index) => ({
        id: `${Date.now()}-${index}`, name: file.name, kind, src
      }));
      if (kind === "cover") setPages((current) => [mapped[0], ...current.filter((page) => page.kind !== "cover")]);
      else if (kind === "index") {
        setPages((current) => {
          const noIndex = current.filter((page) => page.kind !== "index");
          return [noIndex[0], mapped[0], ...noIndex.slice(1)];
        });
      } else setPages((current) => [...current, ...mapped]);
      setSaved(false);
    } catch (error) {
      setUploadError(error?.message || "The selected images could not be added.");
    }
  };

  const pickPlayerAudio = async (file) => {
    if (!activeBookmark) return pickBookAudio(file);
    await replaceActiveBookmarkAudio(file);
  };

  const save = async () => {
    setSaving(true); setSaveError(""); setStorageWarning("");
    const bookId = activeId || crypto.randomUUID();
    try {
      await saveBook({
        id: bookId, title: title || "Untitled score", composer,
        pages, audioSrc, audioName, audioAssetId, pageNumbering, bookmarks,
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
    resetBookAudio(); setActiveId(null); setSpread(1); setMode("studio");
    setPageNumbering(DEFAULT_PAGE_NUMBERING); setSaveError(""); setStorageWarning(""); setUploadError("");
    clearLibraryMessages();
    resetBookmarks();
  };

  const actionError = saveError || libraryError || uploadError;
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
        <div><strong>{uploadError ? "Upload failed" : actionError ? "Storage action failed" : transferNotice ? "Book transfer complete" : "Storage warning"}</strong><p>{actionError || transferNotice || storageWarning}</p></div>
        <button onClick={() => { setSaveError(""); setStorageWarning(""); setUploadError(""); clearLibraryMessages(); }} aria-label="Dismiss notification"><X size={15} /></button>
      </div>}
      {mode === "library" ? <LibraryView books={books} onOpen={openBook} onDelete={removeBook} onCreate={createNew}
        onExport={exportBook} onImport={importBook} importing={importing} /> :
      <main className="workspace">
        <section className="editor-panel">
          <div className="editor-titlebar">
            <div><span className="eyebrow">BOOK SETUP</span><strong>{title || "Untitled score"}</strong></div>
            <span>{pages.length} pages</span>
          </div>
          <div className="editor-tabs" role="tablist" aria-label="Book setup sections">
            {EDITOR_TABS.map((tab) => <button key={tab} id={`editor-tab-${tab}`} role="tab"
              data-tab={tab} aria-selected={editorTab === tab} aria-controls={`editor-panel-${tab}`}
              tabIndex={editorTab === tab ? 0 : -1} className={editorTab === tab ? "active" : ""}
              onKeyDown={(event) => moveTabFocus(event, EDITOR_TABS, setEditorTab)}
              onClick={() => setEditorTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
          </div>
          <div className="editor-scroll">
            {editorTab === "details" && <div className="editor-tab-content" id="editor-panel-details"
              role="tabpanel" aria-labelledby="editor-tab-details">
              <div className="panel-heading compact"><span className="eyebrow">BOOK DETAILS</span><h1>Book setup</h1><p>Name your score and choose its display options.</p></div>
              <label className="field"><span>Title</span><input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} /></label>
              <label className="field"><span>Composer</span><input value={composer} onChange={(e) => { setComposer(e.target.value); setSaved(false); }} /></label>
              <div className="section-rule"><span>DISPLAY OPTIONS</span></div>
              <PageNumberingControls value={pageNumbering} onChange={(next) => {
                setPageNumbering(normalizePageNumbering(next));
                setSaved(false);
              }} />
              <div className="detected-size"><span>Detected page shape</span><strong>Automatic from upload</strong><small>The 3D book follows each page’s original proportions.</small></div>
            </div>}

            {editorTab === "content" && <div className="editor-tab-content" id="editor-panel-content"
              role="tabpanel" aria-labelledby="editor-tab-content">
              <div className="section-title"><div><span className="eyebrow">BOOK CONTENT</span><h2>Pages & files</h2></div><span className="page-count">{pages.length} pages</span></div>
              <div className="upload-stack">
                <UploadTile icon={FileImage} title="Cover artwork" detail="JPG or PNG · up to 20 MB" accept="image/*" filled={pages.some(p => p.kind === "cover")} onFiles={(f) => addImages(f, "cover")} />
                <UploadTile icon={Menu} title="Index page" detail="Optional" accept="image/*" filled={pages.some(p => p.kind === "index")} onFiles={(f) => addImages(f, "index")} />
                <UploadTile inputId="sheet-pages-input" icon={ImagePlus} title="Sheet music pages" detail="Select multiple images" accept="image/*" multiple onFiles={(f) => addImages(f, "page")} />
                <UploadTile inputId="pdf-import-input" icon={FileText} title="Import complete PDF" detail="Up to 50 MB · 200 pages" accept="application/pdf,.pdf" onFiles={beginPdfImport} />
              </div>
              <div className="content-note"><FileText size={16} /><p><strong>PDF import keeps page order.</strong><br />Choose the cover and index after the file is rendered.</p></div>
            </div>}

            {editorTab === "audio" && <AudioEditor audioSrc={audioSrc} audioName={audioName}
              error={audioError} onPick={pickBookAudio} panelId="editor-panel-audio" />}

            {editorTab === "navigation" && <BookmarkEditor
              bookmarks={bookmarks}
              activeBookmarkId={activeBookmarkId}
              currentLocation={spreadLabel(spread)}
              getBookmarkLocation={(bookmark) => spreadLabel(resolveBookmarkSpread(bookmark))}
              onAdd={openBookmarkCreator}
              onOpen={openBookmark}
              onDelete={deleteBookmark}
              panelId="editor-panel-navigation"
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
            fullscreen={fullscreen} onFullscreen={toggleFullscreen} onResetView={resetView} pageNumbering={pageNumbering} />
          <ReaderControls spread={spread} maxSpread={maxSpread} label={spreadLabel(spread)}
            onPrevious={() => navigateReader(-1)} onNext={() => navigateReader(1)} />
          <AudioBar key={activeBookmark?.id || "book-audio"} audioSrc={activeBookmark ? activeBookmark.audioSrc : audioSrc}
            audioName={activeBookmark ? `${activeBookmark.name}${activeBookmark.audioName ? ` · ${activeBookmark.audioName}` : " · No audio attached"}` : audioName} onPick={pickPlayerAudio} />
        </section>

        <aside className="side-panel">
          <div className="side-tabs" role="tablist" aria-label="Book navigation">
            <button id="side-tab-pages" role="tab" data-tab="pages" aria-selected={sideTab === "pages"}
              aria-controls="side-panel-pages" tabIndex={sideTab === "pages" ? 0 : -1}
              className={sideTab === "pages" ? "active" : ""}
              onKeyDown={(event) => moveTabFocus(event, SIDE_TABS, setSideTab)}
              onClick={() => setSideTab("pages")}><FileImage size={14} /> Pages</button>
            <button id="side-tab-bookmarks" role="tab" data-tab="bookmarks" aria-selected={sideTab === "bookmarks"}
              aria-controls="side-panel-bookmarks" tabIndex={sideTab === "bookmarks" ? 0 : -1}
              className={sideTab === "bookmarks" ? "active" : ""}
              onKeyDown={(event) => moveTabFocus(event, SIDE_TABS, setSideTab)}
              onClick={() => setSideTab("bookmarks")}><Bookmark size={14} /> Bookmarks <span>{bookmarks.length}</span></button>
          </div>
          {sideTab === "pages" ? <div id="side-panel-pages" role="tabpanel" aria-labelledby="side-tab-pages">
            <div className="side-panel-head"><span>ALL PAGES ({pages.length})</span><small>Quick jump</small></div>
            <PageGrid pages={pages}
              activePageIds={spread === 0 ? [pages[0]?.id] : [
                pages[1 + (spread - 1) * 2]?.id,
                pages[2 + (spread - 1) * 2]?.id
              ].filter(Boolean)}
              onOpen={(index) => { jumpToPage(index); clearActiveBookmark(); }}
              onReorder={reorderPages} />
            <div className="side-panel-footer"><button onClick={() => { setEditorTab("content"); setTimeout(() => document.getElementById("sheet-pages-input")?.click(), 0); }}><Plus size={14} /> Add pages</button></div>
          </div> : <div id="side-panel-bookmarks" role="tabpanel" aria-labelledby="side-tab-bookmarks"><BookmarkSidebar
            bookmarks={bookmarks}
            activeBookmarkId={activeBookmarkId}
            getBookmarkLocation={(bookmark) => spreadLabel(resolveBookmarkSpread(bookmark))}
            onAdd={openBookmarkCreator}
            onOpen={openBookmark}
          /></div>}
        </aside>
      </main>}
      <BookmarkModal
        draft={bookmarkDraft}
        location={spreadLabel(bookmarkDraft?.spread ?? spread)}
        audioError={bookmarkAudioError}
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
