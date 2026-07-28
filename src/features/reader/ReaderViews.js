import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Rotate3D } from "lucide-react";
import { spreadPageIndices } from "./reader-geometry.js";

export function BookStage({
  pages,
  spread,
  tilt,
  setTilt,
  turning,
  fullscreen,
  onFullscreen,
  onResetView,
  showPageNumbers
}) {
  const stage = useRef(null);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, rx: 0, ry: 0 });
  const [bookAspect, setBookAspect] = useState(1.414);
  const { spread: safeSpread, leftIndex, rightIndex } = spreadPageIndices(spread, pages.length);
  const left = pages[leftIndex] || pages[0];
  const right = rightIndex !== null ? pages[rightIndex] : null;

  const down = (event) => {
    if (event.target.closest(".stage-button")) return;
    dragging.current = true;
    start.current = { x: event.clientX, y: event.clientY, rx: tilt.x, ry: tilt.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    if (!dragging.current) return;
    setTilt({
      x: Math.max(-18, Math.min(18, start.current.rx - (event.clientY - start.current.y) * .08)),
      y: Math.max(-28, Math.min(28, start.current.ry + (event.clientX - start.current.x) * .1))
    });
  };
  const up = () => { dragging.current = false; };
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
        <button className="stage-button" onClick={onResetView}>Reset view</button>
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

export function ReaderControls({ spread, maxSpread, label, onPrevious, onNext }) {
  return (
    <div className="reader-controls">
      <button onClick={onPrevious} disabled={spread <= 0}><ChevronLeft size={21} /></button>
      <div><strong>{label}</strong><small>{spread + 1} of {maxSpread + 1}</small></div>
      <button onClick={onNext} disabled={spread >= maxSpread}><ChevronRight size={21} /></button>
    </div>
  );
}
