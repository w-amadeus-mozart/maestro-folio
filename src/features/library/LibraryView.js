import { useRef } from "react";
import { BookOpen, Download, Loader2, Plus, Trash2, Upload } from "lucide-react";

export function LibraryView({ books, onOpen, onDelete, onCreate, onExport, onImport, importing }) {
  const importInput = useRef(null);

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
      <div className="library-grid">
        {books.map((book) => (
          <article className="library-card" key={book.id}>
            <button className="cover-button" onClick={() => onOpen(book)}>
              <img src={book.pages?.[0]?.src || "/cover.svg"} alt={book.title} />
              <span className="open-pill"><BookOpen size={15} /> Open book</span>
            </button>
            <div className="card-copy">
              <div><h3>{book.title}</h3><p>{book.composer || "Unknown composer"}</p></div>
              <div className="card-actions">
                <button className="export-button" onClick={() => onExport(book)} aria-label={`Export ${book.title}`}>
                  <Download size={15} />
                </button>
                <button className="delete-button" onClick={() => onDelete(book.id)} aria-label={`Delete ${book.title}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="card-meta"><span>{book.pageCount ?? book.pages?.length ?? 0} pages</span><span>{book.audioSrc ? "With audio" : "Score only"}</span></div>
          </article>
        ))}
        <button className="new-card" onClick={onCreate}><span><Plus size={25} /></span><strong>Create a new book</strong><small>Bring another score to life</small></button>
      </div>
    </main>
  );
}
