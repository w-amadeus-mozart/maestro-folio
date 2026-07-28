import { useMemo, useRef, useState } from "react";
import { BookCopy, BookOpen, Check, Download, Loader2, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { LIBRARY_SORTS, organizeBooks } from "./library-organize.js";

export function LibraryView({ books, onOpen, onDelete, onDuplicate, onRename, onCreate, onExport, onImport, importing }) {
  const importInput = useRef(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [editingId, setEditingId] = useState(null);
  const [titleDraft, setTitleDraft] = useState("");
  const visibleBooks = useMemo(() => organizeBooks(books, query, sort), [books, query, sort]);
  const beginRename = (book) => {
    setEditingId(book.id);
    setTitleDraft(book.title);
  };
  const confirmRename = async (book) => {
    if (await onRename(book, titleDraft)) setEditingId(null);
  };

  return (
    <main className="library-view">
      <div className="library-heading">
        <div><span className="eyebrow">YOUR COLLECTION</span><h1>Music worth returning to.</h1>
          <p>Every score, thoughtfully preserved and ready to play on this device.</p></div>
        <div className="library-actions">
          <button className="secondary" onClick={() => importInput.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
            {importing ? "Importing" : "Import book"}
          </button>
          <input ref={importInput} hidden type="file"
            accept=".maestro-folio,application/vnd.maestro-folio.book+json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onImport(file);
            }} />
          <button className="primary" onClick={onCreate}><Plus size={17} /> Create new book</button>
        </div>
      </div>
      <div className="library-tools">
        <label className="library-search"><Search size={16} /><span className="sr-only">Search books</span>
          <input type="search" value={query} placeholder="Search title or composer"
            onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="library-sort">Sort by
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {Object.entries(LIBRARY_SORTS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <span aria-live="polite">{visibleBooks.length} {visibleBooks.length === 1 ? "book" : "books"}</span>
      </div>
      <div className="library-grid">
        {visibleBooks.map((book) => (
          <article className="library-card" key={book.id}>
            <button className="cover-button" onClick={() => onOpen(book)}>
              <img src={book.pages?.[0]?.src || "/cover.svg"} alt={book.title} />
              <span className="open-pill"><BookOpen size={15} /> Open book</span>
            </button>
            <div className="card-copy">
              {editingId === book.id ? <div className="library-rename">
                <label><span className="sr-only">New title for {book.title}</span>
                  <input autoFocus value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") confirmRename(book);
                      if (event.key === "Escape") setEditingId(null);
                    }} />
                </label>
                <button onClick={() => confirmRename(book)} aria-label={`Save title for ${book.title}`}><Check size={14} /></button>
                <button onClick={() => setEditingId(null)} aria-label={`Cancel renaming ${book.title}`}><X size={14} /></button>
              </div> : <div><h3>{book.title}</h3><p>{book.composer || "Unknown composer"}</p></div>}
              <div className="card-actions">
                <button onClick={() => beginRename(book)} aria-label={`Rename ${book.title}`}><Pencil size={14} /></button>
                <button onClick={() => onDuplicate(book)} aria-label={`Duplicate ${book.title}`}><BookCopy size={15} /></button>
                <button className="export-button" onClick={() => onExport(book)} aria-label={`Export ${book.title}`}>
                  <Download size={15} />
                </button>
                <button className="delete-button"
                  onClick={() => window.confirm(`Delete “${book.title}” and all of its stored media? This cannot be undone.`) && onDelete(book.id)}
                  aria-label={`Delete ${book.title}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="card-meta"><span>{book.pageCount ?? book.pages?.length ?? 0} pages</span><span>{book.audioSrc ? "With audio" : "Score only"}</span></div>
          </article>
        ))}
        {!visibleBooks.length && query && <div className="library-empty"><Search size={22} /><strong>No matching books</strong><small>Try another title or composer.</small></div>}
        {!query && <button className="new-card" onClick={onCreate}><span><Plus size={25} /></span><strong>Create a new book</strong><small>Bring another score to life</small></button>}
      </div>
    </main>
  );
}
