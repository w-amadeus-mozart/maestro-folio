import { useRef } from "react";
import { Bookmark, BookmarkPlus, ChevronRight, Headphones, Plus, Trash2, X } from "lucide-react";

export function BookmarkEditor({
  bookmarks,
  activeBookmarkId,
  currentLocation,
  getBookmarkLocation,
  onAdd,
  onOpen,
  onDelete
}) {
  return (
    <div className="editor-tab-content">
      <div className="bookmark-heading">
        <div><span className="eyebrow">NAVIGATION</span><h3>Bookmarks</h3></div>
        <button onClick={onAdd}><BookmarkPlus size={14} /> Add</button>
      </div>
      <p className="bookmark-current">Current location: <strong>{currentLocation}</strong></p>
      {bookmarks.length === 0 ? (
        <div className="bookmark-empty"><Bookmark size={18} /><span>No bookmarks yet</span><small>Save a cover, index, or named piece.</small></div>
      ) : (
        <div className="bookmark-list">{bookmarks.map((bookmark) => (
          <article className={`bookmark-row ${activeBookmarkId === bookmark.id ? "active" : ""}`} key={bookmark.id}>
            <button className="bookmark-open" onClick={() => onOpen(bookmark)}>
              <span className="bookmark-pin"><Bookmark size={14} fill="currentColor" /></span>
              <span><strong>{bookmark.name}</strong><small>{getBookmarkLocation(bookmark)}{bookmark.audioName ? ` · ${bookmark.audioName}` : " · No audio"}</small></span>
            </button>
            <button className="bookmark-delete" onClick={() => onDelete(bookmark.id)} aria-label={`Delete ${bookmark.name}`}><Trash2 size={13} /></button>
          </article>
        ))}</div>
      )}
    </div>
  );
}

export function BookmarkSidebar({ bookmarks, activeBookmarkId, getBookmarkLocation, onAdd, onOpen }) {
  return (
    <>
      <div className="side-panel-head"><span>BOOKMARKS ({bookmarks.length})</span><button onClick={onAdd}><Plus size={13} /> Add here</button></div>
      <div className="side-bookmark-list">
        {bookmarks.length === 0 ? (
          <div className="side-empty"><Bookmark size={21} /><strong>No bookmarks</strong><small>Navigate to a page and add one.</small></div>
        ) : bookmarks.map((bookmark) => (
          <button key={bookmark.id} className={activeBookmarkId === bookmark.id ? "active" : ""} onClick={() => onOpen(bookmark)}>
            <span><Bookmark size={14} fill="currentColor" /></span>
            <div><strong>{bookmark.name}</strong><small>{getBookmarkLocation(bookmark)}{bookmark.audioName ? " · Audio" : ""}</small></div>
            <ChevronRight size={14} />
          </button>
        ))}
      </div>
    </>
  );
}

export function BookmarkModal({ draft, location, onNameChange, onConfirm, onClose, onAudio }) {
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
            onChange={(event) => onNameChange(event.target.value)} />
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
