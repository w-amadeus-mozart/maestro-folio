import { useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { canReorderPage, firstReorderableIndex } from "./page-order.js";

export function PageGrid({ pages, activePageIds, onOpen, onReorder }) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const firstMovable = firstReorderableIndex(pages);

  const move = (fromIndex, toIndex) => {
    if (!canReorderPage(pages, fromIndex)) return;
    const destination = Math.max(firstMovable, Math.min(pages.length - 1, toIndex));
    if (destination === fromIndex) return;
    onReorder(fromIndex, destination);
    setAnnouncement(`${pages[fromIndex].name} moved to position ${destination + 1}.`);
  };

  return (
    <>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <div className="side-page-grid">
        {pages.map((page, index) => {
          const movable = canReorderPage(pages, index);
          const active = activePageIds.includes(page.id);
          return (
            <article key={page.id} className={`side-page-card ${active ? "active" : ""} ${draggedIndex === index ? "dragging" : ""}`}
              draggable={movable}
              onDragStart={(event) => {
                if (!movable) return;
                setDraggedIndex(index);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", page.id);
              }}
              onDragEnd={() => setDraggedIndex(null)}
              onDragOver={(event) => movable && event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedIndex !== null) move(draggedIndex, index);
                setDraggedIndex(null);
              }}>
              <button className="page-open" onClick={() => onOpen(index)}
                aria-label={`Open ${page.name}${page.kind !== "page" ? `, ${page.kind}` : ""}`}>
                <img src={page.src} alt="" />
                <span>{page.kind === "cover" ? "Cover" : page.kind === "index" ? "Index" : index}</span>
              </button>
              {movable ? (
                <div className="page-order-controls">
                  <GripVertical size={12} aria-hidden="true" />
                  <button aria-label={`Move ${page.name} earlier`} disabled={index === firstMovable}
                    onClick={() => move(index, index - 1)}><ChevronLeft size={12} /></button>
                  <button aria-label={`Move ${page.name} later`} disabled={index === pages.length - 1}
                    onClick={() => move(index, index + 1)}><ChevronRight size={12} /></button>
                </div>
              ) : <span className="page-role-lock">{page.kind}</span>}
            </article>
          );
        })}
      </div>
    </>
  );
}
