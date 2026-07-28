import { BookOpen, Check, Loader2, X } from "lucide-react";

export function PdfImportModal({ state, onChooseCover, onChooseIndex, onConfirm, onClose }) {
  if (!state.open) return null;

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
            <p>Creating clear previews from your PDF. You can cancel without changing the current book.</p>
            <button className="pdf-cancel" onClick={onClose}>Cancel import</button>
          </div>
        ) : state.status === "error" ? (
          <div className="pdf-error"><strong>We couldn’t read this PDF.</strong><p>{state.error}</p></div>
        ) : (
          <>
            <div className="pdf-role-controls">
              <label><span>Front cover</span>
                <select value={state.frontIndex} onChange={(event) => onChooseCover(Number(event.target.value))}>
                  {state.pages.map((_, index) => <option key={index} value={index}>PDF page {index + 1}</option>)}
                </select>
              </label>
              <label><span>Index page</span>
                <select value={state.indexIndex} onChange={(event) => onChooseIndex(Number(event.target.value))}>
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
                      <button className={isCover ? "selected" : ""} onClick={() => onChooseCover(index)}>{isCover && <Check size={12} />} Cover</button>
                      <button className={isIndex ? "selected" : ""} disabled={isCover} onClick={() => onChooseIndex(index)}>{isIndex && <Check size={12} />} Index</button>
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
