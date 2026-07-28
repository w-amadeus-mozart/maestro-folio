import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { maxSpreadForPageCount, pageIndexToSpread } from "./reader-geometry.js";

export function useReaderNavigation(pageCount) {
  const [spread, setSpread] = useState(1);
  const [tilt, setTilt] = useState({ x: 7, y: -4 });
  const [turning, setTurning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const spreadTimer = useRef(null);
  const turnTimer = useRef(null);
  const maxSpread = useMemo(() => maxSpreadForPageCount(pageCount), [pageCount]);

  useEffect(() => () => {
    clearTimeout(spreadTimer.current);
    clearTimeout(turnTimer.current);
  }, []);

  const go = useCallback((delta) => {
    if (turning) return false;
    const next = Math.max(0, Math.min(maxSpread, spread + delta));
    if (next === spread) return false;
    setTurning(delta > 0 ? "next" : "prev");
    spreadTimer.current = setTimeout(() => setSpread(next), 280);
    turnTimer.current = setTimeout(() => setTurning(false), 620);
    return true;
  }, [maxSpread, spread, turning]);

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
    turning,
    fullscreen,
    maxSpread,
    go,
    jumpToPage,
    resetView,
    toggleFullscreen,
    closeFullscreen
  };
}
