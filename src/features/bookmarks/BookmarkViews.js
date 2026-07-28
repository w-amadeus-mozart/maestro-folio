import { useRef, useState } from "react";
import {
  Bookmark, BookmarkPlus, ChevronDown, ChevronRight, ChevronUp, GripVertical,
  Headphones, MapPin, Pencil, Plus, Trash2, X
} from "lucide-react";
import { useDialogFocus } from "../../shared/use-dialog-focus.js";

export function BookmarkEditor({
  bookmarks,
  activeBookmarkId,
  currentLocation,
  getBookmarkLocation,
  onAdd,
  onOpen,
  onEdit,
  onDelete,
  onReorder,
  panelId
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const move = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= bookmarks.length || fromIndex === toIndex) return;
    onReorder(fromIndex, toIndex);
    setAnnouncement(`${bookmarks[fromIndex].name} moved to position ${toIndex + 1}.`);
  };
  return (
    <div className="editor-tab-content" id={panelId} role="tabpanel" aria-labelledby="editor-tab-navigation">
      <div className="bookmark-heading">
        <div><span className="eyebrow">NAVIGATION</span><h3>Bookmarks</h3></div>
        <button onClick={onAdd}><BookmarkPlus size={14} /> Add</button>
      </div>
      <p className="bookmark-current">Current location: <strong>{currentLocation}</strong></p>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {bookmarks.length === 0 ? (
        <div className="bookmark-empty"><Bookmark size={18} /><span>No bookmarks yet</span><small>Save a cover, index, or named piece.</small></div>
      ) : (
        <div className="bookmark-list">{bookmarks.map((bookmark, index) => (
          <article className={`bookmark-row ${activeBookmarkId === bookmark.id ? "active" : ""} ${draggedIndex === index ? "dragging" : ""}`}
            key={bookmark.id} draggable
            onDragStart={(event) => {
              setDraggedIndex(index);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", bookmark.id);
            }}
            onDragEnd={() => setDraggedIndex(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedIndex !== null) move(draggedIndex, index);
              setDraggedIndex(null);
            }}>
            <button className="bookmark-open" onClick={() => onOpen(bookmark)}>
              <span className="bookmark-pin"><Bookmark size={14} fill="currentColor" /></span>
              <span><strong>{bookmark.name}</strong><small>{getBookmarkLocation(bookmark)}{bookmark.audioName ? ` · ${bookmark.audioName}` : " · No audio"}</small></span>
            </button>
            <div className="bookmark-row-actions">
              <GripVertical size={12} aria-hidden="true" />
              <button onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`Move ${bookmark.name} earlier`}><ChevronUp size={12} /></button>
              <button onClick={() => move(index, index + 1)} disabled={index === bookmarks.length - 1} aria-label={`Move ${bookmark.name} later`}><ChevronDown size={12} /></button>
              <button onClick={() => onEdit(bookmark)} aria-label={`Edit ${bookmark.name}`}><Pencil size={12} /></button>
              <button onClick={() => window.confirm(`Delete “${bookmark.name}”? This cannot be undone.`) && onDelete(bookmark.id)}
                aria-label={`Delete ${bookmark.name}`}><Trash2 size={12} /></button>
            </div>
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

export function BookmarkModal({
  draft,
  location,
  currentLocation,
  audioError,
  onNameChange,
  onRetarget,
  onConfirm,
  onClose,
  onAudio,
  onRemoveAudio
}) {
  const audioInput = useRef(null);
  const dialogRef = useDialogFocus(Boolean(draft), onClose);
  if (!draft) return null;

  return (
    <div className="bookmark-modal-backdrop">
      <div ref={dialogRef} className="bookmark-modal" role="dialog" aria-modal="true"
        aria-labelledby="bookmark-dialog-title" aria-describedby="bookmark-dialog-location" tabIndex={-1}>
        <div className="bookmark-modal-icon"><BookmarkPlus size={23} /></div>
        <button className="bookmark-modal-close" onClick={onClose} aria-label="Close"><X size={17} /></button>
        <span className="eyebrow">{draft.mode === "edit" ? "EDIT BOOKMARK" : "NEW BOOKMARK"}</span>
        <h2 id="bookmark-dialog-title">{draft.mode === "edit" ? "Edit bookmark" : "Name this piece"}</h2>
        <p id="bookmark-dialog-location" className="bookmark-location"><Bookmark size={13} /> {location}</p>
        <label className="field"><span>Bookmark name</span>
          <input data-dialog-initial-focus value={draft.name} placeholder="e.g. Piece 10 · Amazing Grace"
            onChange={(event) => onNameChange(event.target.value)} />
        </label>
        {draft.mode === "edit" && <div className="bookmark-target-field">
          <div><span>Saved destination</span><strong>{location}</strong><small>Current reader: {currentLocation}</small></div>
          <button onClick={onRetarget}><MapPin size={14} /> Use current page</button>
        </div>}
        <div className="bookmark-audio-field">
          <div><span>Audio file · optional</span><strong>{draft.audioName || "No recording attached"}</strong><small>MP3, WAV or M4A · up to 100 MB</small></div>
          <button onClick={() => audioInput.current?.click()}><Headphones size={15} /> {draft.audioSrc ? "Replace" : "Choose audio"}</button>
          <input ref={audioInput} hidden type="file" accept="audio/*" onChange={(event) => event.target.files[0] && onAudio(event.target.files[0])} />
        </div>
        {draft.audioSrc && <button className="remove-bookmark-audio"
          onClick={() => window.confirm("Remove this bookmark recording?") && onRemoveAudio()}>
          <Trash2 size={13} /> Remove recording
        </button>}
        {audioError && <p className="field-error" role="alert">{audioError}</p>}
        <div className="bookmark-modal-actions">
          <button className="pdf-cancel" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!draft.name.trim()} onClick={onConfirm}>
            {draft.mode === "edit" ? <Pencil size={16} /> : <BookmarkPlus size={16} />}
            {draft.mode === "edit" ? "Save changes" : "Add bookmark"}
          </button>
        </div>
      </div>
    </div>
  );
}
