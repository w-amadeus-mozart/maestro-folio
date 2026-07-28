import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { maxSpreadForPageCount, pageIndexToSpread } from "./reader-geometry.js";
import { TURN_DURATION_MS, TURN_FAILSAFE_EXTRA_MS } from "./reader-turn.js";

/**
 * Turn state:
 *   null — no turn in progress
 *   { dir: "next"|"prev", from, to, mode, settleMs? }
 *     mode "auto"            — keyframe-driven turn (buttons/keyboard)
 *     mode "drag"            — pointer is holding the sheet
 *     mode "settle-complete" — released, animating to the new spread
 *     mode "settle-cancel"   — released, animating back to the old spread
 *
 * The visible spread state is committed up front (auto/settle-complete);
 * during the turn BookStage renders from the turn object, so nothing pops.
 * The view reports animation completion through finishTurn (animationend /
 * transitionend); a failsafe timer guarantees the lock is always released.
 */
export function useReaderNavigation(pageCount) {
  const [spread, setSpread] = useState(1);
  const [tilt, setTilt] = useState({ x: 7, y: -4 });
  const [turn, setTurn] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const pendingDelta = useRef(null);
  const failSafe = useRef(null);
  const maxSpread = useMemo(() => maxSpreadForPageCount(pageCount), [pageCount]);

  useEffect(() => () => clearTimeout(failSafe.current), []);

  const armFailSafe = useCallback((ms) => {
    clearTimeout(failSafe.current);
    failSafe.current = setTimeout(() => setTurn(null), ms);
  }, []);

  const finishTurn = useCallback(() => {
    clearTimeout(failSafe.current);
    setTurn(null);
  }, []);

  const go = useCallback((delta) => {
    if (turn) {
      // Queue the latest request instead of dropping rapid input.
      pendingDelta.current = delta;
      return true;
    }
    const next = Math.max(0, Math.min(maxSpread, spread + delta));
    if (next === spread) return false;
    setTurn({ dir: delta > 0 ? "next" : "prev", from: spread, to: next, mode: "auto" });
    setSpread(next);
    armFailSafe(TURN_DURATION_MS + TURN_FAILSAFE_EXTRA_MS);
    return true;
  }, [maxSpread, spread, turn, armFailSafe]);

  // Run a queued navigation as soon as the current turn finishes.
  useEffect(() => {
    if (turn || pendingDelta.current === null) return;
    const delta = pendingDelta.current;
    pendingDelta.current = null;
    go(delta);
  }, [turn, go]);

  const startPageDrag = useCallback((dir) => {
    if (turn) return false;
    const to = spread + (dir === "next" ? 1 : -1);
    if (to < 0 || to > maxSpread) return false;
    setTurn({ dir, from: spread, to, mode: "drag" });
    return true;
  }, [turn, spread, maxSpread]);

  const endPageDrag = useCallback((complete, settleMs = TURN_DURATION_MS) => {
    if (!turn || turn.mode !== "drag") return;
    if (complete) setSpread(turn.to);
    setTurn({ ...turn, mode: complete ? "settle-complete" : "settle-cancel", settleMs });
    armFailSafe(settleMs + TURN_FAILSAFE_EXTRA_MS);
  }, [turn, armFailSafe]);

  const jumpToPage = useCallback((pageIndex) => {
    setSpread(pageIndexToSpread(pageIndex));
  }, []);

  const resetView = useCallback(() => setTilt({ x: 7, y: -4 }), []);
  const toggleFullscreen = useCallback(() => setFullscreen((current) => !current), []);
  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  return {
    spread,
    setSpread,
    tilt,
    setTilt,
    turn,
    turning: turn ? turn.dir : false,
    fullscreen,
    maxSpread,
    go,
    finishTurn,
    startPageDrag,
    endPageDrag,
    jumpToPage,
    resetView,
    toggleFullscreen,
    closeFullscreen
  };
}
