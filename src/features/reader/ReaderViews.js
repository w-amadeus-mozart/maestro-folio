import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Rotate3D } from "lucide-react";
import { spreadPageIndices } from "./reader-geometry.js";
import {
  TURN_DURATION_MS,
  TURN_TAP_SLOP_PX,
  dragProgress,
  settleDuration,
  shouldCompleteTurn,
  turnAngle,
  turnPageIndices,
  turnShade
} from "./reader-turn.js";
import { pageNumberClass, pageNumberForIndex } from "../pages/page-numbering.js";

// Fraction of the book width (from each edge) that grabs the page instead of
// tilting the book. The middle band keeps the existing drag-to-explore tilt.
const EDGE_GRAB_ZONE = 0.38;

export function BookStage({
  pages,
  spread,
  tilt,
  setTilt,
  turn,
  fullscreen,
  onFullscreen,
  onResetView,
  onTurnEnd,
  onStartPageDrag,
  onEndPageDrag,
  pageNumbering
}) {
  const stage = useRef(null);
  const wrapRef = useRef(null);
  const bookRef = useRef(null);
  const sheetRef = useRef(null);
  const tiltDrag = useRef(false);
  const pageDrag = useRef(null);
  const start = useRef({ x: 0, y: 0, rx: 0, ry: 0 });
  const [bookAspect, setBookAspect] = useState(1.414);

  const { leftIndex, rightIndex } = spreadPageIndices(spread, pages.length);
  const turnIndices = turn ? turnPageIndices(turn.from, turn.to, pages.length) : null;

  // While a turn is active the flat pages come from the turn model — the
  // outgoing and incoming halves that do not move. Otherwise from the spread.
  const displayLeftIndex = turnIndices ? turnIndices.staticLeftIndex : leftIndex;
  const displayRightIndex = turnIndices ? turnIndices.staticRightIndex : rightIndex;
  const left = displayLeftIndex === null ? null : pages[displayLeftIndex] || pages[0];
  const right = displayRightIndex === null ? null : pages[displayRightIndex];
  const sheetFront = turnIndices && turnIndices.sheetFrontIndex !== null ? pages[turnIndices.sheetFrontIndex] : null;
  const sheetBack = turnIndices && turnIndices.sheetBackIndex !== null ? pages[turnIndices.sheetBackIndex] : null;
  const leftNumber = left && displayLeftIndex !== null ? pageNumberForIndex(pages, displayLeftIndex, pageNumbering) : null;
  const rightNumber = right && displayRightIndex !== null ? pageNumberForIndex(pages, displayRightIndex, pageNumbering) : null;
  const bookOpen = turn ? true : Boolean(right);

  const applySheetPose = (progress, dir) => {
    const sheet = sheetRef.current;
    const wrap = wrapRef.current;
    if (sheet) {
      const lift = Math.sin(Math.PI * progress) * 22;
      sheet.style.transform = `rotateY(${turnAngle(progress, dir)}deg) translateZ(${lift.toFixed(1)}px)`;
    }
    if (wrap) wrap.style.setProperty("--sheet-shade", turnShade(progress).toFixed(3));
  };

  // Released drags settle to their end pose with a transition sized to the
  // remaining travel; transitionend (or the hook's failsafe) ends the turn.
  useEffect(() => {
    if (!turn || (turn.mode !== "settle-complete" && turn.mode !== "settle-cancel")) return;
    const sheet = sheetRef.current;
    const wrap = wrapRef.current;
    if (!sheet) return;
    const completing = turn.mode === "settle-complete";
    const endProgress = completing ? 1 : 0;
    const frame = requestAnimationFrame(() => {
      sheet.style.transition = `transform ${turn.settleMs || TURN_DURATION_MS}ms cubic-bezier(.25,.6,.3,1)`;
      sheet.style.transform = `rotateY(${turnAngle(endProgress, turn.dir)}deg) translateZ(0px)`;
      if (wrap) wrap.style.setProperty("--sheet-shade", "0");
    });
    return () => cancelAnimationFrame(frame);
  }, [turn]);

  // Clear the shade once a turn is fully over.
  useEffect(() => {
    if (!turn && wrapRef.current) wrapRef.current.style.setProperty("--sheet-shade", "0");
  }, [turn]);

  const beginPageDrag = (event) => {
    const book = bookRef.current;
    if (!book || turn) return false;
    const rect = book.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) return false;
    const relative = (event.clientX - rect.left) / rect.width;
    let dir = null;
    if (spread === 0) dir = "next";
    else if (relative >= 1 - EDGE_GRAB_ZONE) dir = "next";
    else if (relative <= EDGE_GRAB_ZONE) dir = "prev";
    if (!dir || !onStartPageDrag?.(dir)) return false;
    pageDrag.current = {
      dir,
      startX: event.clientX,
      lastT: performance.now(),
      progress: 0,
      velocity: 0,
      width: rect.width
    };
    return true;
  };

  const releasePageDrag = (event, forceCancel = false) => {
    const drag = pageDrag.current;
    if (!drag) return false;
    pageDrag.current = null;
    const moved = Math.abs(event.clientX - drag.startX);
    const tap = !forceCancel && moved < TURN_TAP_SLOP_PX && drag.progress < 0.03;
    const complete = forceCancel ? false : tap || shouldCompleteTurn(drag.progress, drag.velocity);
    onEndPageDrag?.(complete, tap ? TURN_DURATION_MS : settleDuration(drag.progress, complete));
    return true;
  };

  const down = (event) => {
    if (event.target.closest(".stage-button")) return;
    if (beginPageDrag(event)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    tiltDrag.current = true;
    start.current = { x: event.clientX, y: event.clientY, rx: tilt.x, ry: tilt.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    const drag = pageDrag.current;
    if (drag) {
      const now = performance.now();
      const progress = dragProgress(drag.startX, event.clientX, drag.width, drag.dir);
      const dt = Math.max(1, now - drag.lastT);
      drag.velocity = drag.velocity * 0.75 + ((progress - drag.progress) / dt) * 1000 * 0.25;
      drag.progress = progress;
      drag.lastT = now;
      applySheetPose(progress, drag.dir);
      return;
    }
    if (!tiltDrag.current) return;
    setTilt({
      x: Math.max(-18, Math.min(18, start.current.rx - (event.clientY - start.current.y) * .08)),
      y: Math.max(-28, Math.min(28, start.current.ry + (event.clientX - start.current.x) * .1))
    });
  };
  const up = (event) => {
    if (releasePageDrag(event)) return;
    tiltDrag.current = false;
  };
  const cancel = (event) => {
    if (releasePageDrag(event, true)) return;
    tiltDrag.current = false;
  };

  const sheetAnimationEnd = (event) => {
    if (event.animationName?.startsWith("flip-")) onTurnEnd?.();
  };
  const sheetTransitionEnd = (event) => {
    if (event.propertyName === "transform" && event.target === sheetRef.current) onTurnEnd?.();
  };

  const measurePage = (event) => {
    const image = event.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight) return;
    const spreadAspect = (image.naturalWidth / image.naturalHeight) * 2;
    setBookAspect(Math.max(1.1, Math.min(2.2, spreadAspect)));
  };

  return (
    <div ref={stage} className={`book-stage ${fullscreen ? "stage-fullscreen" : ""}`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}>
      <div className="stage-toolbar">
        <span><Rotate3D size={15} /> Drag to explore</span>
        <button className="stage-button" onClick={onResetView}>Reset view</button>
        <button className="stage-button icon-only" aria-label={fullscreen ? "Exit fullscreen reader" : "Open fullscreen reader"}
          onClick={onFullscreen}><Maximize2 size={15} /></button>
      </div>
      <div className="ambient-glow" />
      <div ref={wrapRef}
        className={`book-wrap ${turn ? `is-turning turn-${turn.dir} mode-${turn.mode}` : ""}`}
        style={{
          "--book-aspect": bookAspect,
          "--turn-ms": `${TURN_DURATION_MS}ms`,
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
        }}>
        <div ref={bookRef} className={`book ${bookOpen ? "open" : "closed"}`}>
          {left && <div className="book-page left-page">
            <img src={left.src} alt={left.name || "Book page"} onLoad={measurePage} />
            {leftNumber !== null && <span className={pageNumberClass("left", pageNumbering)}>{leftNumber}</span>}
          </div>}
          {right && <div className="book-page right-page">
            <img src={right.src} alt={right.name} />
            {rightNumber !== null && <span className={pageNumberClass("right", pageNumbering)}>{rightNumber}</span>}
          </div>}
          {turn && <div className="turn-shadow" />}
          {turn && <div ref={sheetRef} className={`turning-page turn-${turn.dir} mode-${turn.mode}`}
            onAnimationEnd={sheetAnimationEnd} onTransitionEnd={sheetTransitionEnd}>
            <div className="turning-front">
              {sheetFront && <img src={sheetFront.src} alt={sheetFront.name || "Turning page"} draggable={false} />}
            </div>
            <div className="turning-back">
              {sheetBack && <img src={sheetBack.src} alt={sheetBack.name || "Turning page"} draggable={false} />}
            </div>
          </div>}
          <div className="spine-shine" />
        </div>
      </div>
      <span className="stage-hint">Drag a page edge, click the arrows, or use your keyboard to turn pages</span>
    </div>
  );
}

export function ReaderControls({ spread, maxSpread, label, onPrevious, onNext }) {
  return (
    <div className="reader-controls">
      <button aria-label="Previous spread" onClick={onPrevious} disabled={spread <= 0}><ChevronLeft size={21} /></button>
      <div><strong>{label}</strong><small>{spread + 1} of {maxSpread + 1}</small></div>
      <button aria-label="Next spread" onClick={onNext} disabled={spread >= maxSpread}><ChevronRight size={21} /></button>
    </div>
  );
}
