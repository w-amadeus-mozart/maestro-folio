import { spreadPageIndices } from "./reader-geometry.js";

// Single source of truth for turn timing. CSS reads this through the
// `--turn-ms` custom property that BookStage sets inline on the book wrapper.
export const TURN_DURATION_MS = 620;
export const TURN_FAILSAFE_EXTRA_MS = 220;
export const TURN_COMPLETE_THRESHOLD = 0.5;
export const TURN_FLICK_VELOCITY = 1.4; // progress units per second
export const TURN_MIN_SETTLE_MS = 160;
export const TURN_TAP_SLOP_PX = 5;

/**
 * Resolves the four page slots involved in a turn between two adjacent
 * spreads, regardless of direction.
 *
 * - staticLeftIndex:  page that stays flat on the left for the whole turn
 *                     (null when the lower spread is the closed cover — the
 *                     book board shows instead)
 * - sheetFrontIndex:  page printed on the face of the turning sheet that is
 *                     visible when the sheet lies on the right half
 * - sheetBackIndex:   page printed on the reverse face (visible on the left)
 * - staticRightIndex: page that stays flat on the right for the whole turn
 *                     (null on an odd final spread — blank paper shows)
 */
export function turnPageIndices(fromSpread, toSpread, pageCount) {
  const lower = Math.min(fromSpread, toSpread);
  const upper = Math.max(fromSpread, toSpread);
  const lowerPages = spreadPageIndices(lower, pageCount);
  const upperPages = spreadPageIndices(upper, pageCount);
  return {
    staticLeftIndex: lower === 0 ? null : lowerPages.leftIndex,
    sheetFrontIndex: lower === 0 ? 0 : lowerPages.rightIndex,
    sheetBackIndex: upperPages.leftIndex,
    staticRightIndex: upperPages.rightIndex
  };
}

/**
 * Maps a horizontal pointer displacement to turn progress in [0, 1].
 * Dragging across the full spread width corresponds to a complete turn;
 * a small assist factor makes the turn feel light in the hand.
 */
export function dragProgress(startX, currentX, spreadWidth, dir) {
  const travel = Math.max(1, spreadWidth);
  const dx = currentX - startX;
  const raw = (dir === "next" ? -dx : dx) / travel;
  return Math.max(0, Math.min(1, raw * 1.15));
}

/**
 * Sheet rotation for a given progress. The sheet is anchored on the spine:
 * 0deg lies flat on the right, -180deg lies flat on the left.
 */
export function turnAngle(progress, dir) {
  return dir === "next" ? -180 * progress : -180 * (1 - progress);
}

/** Perceived lift/shadow strength — peaks when the sheet is edge-on. */
export function turnShade(progress) {
  return Math.sin(Math.PI * Math.max(0, Math.min(1, progress))) * 0.55;
}

/**
 * Decides whether a released drag should finish the turn or fall back.
 * `velocity` is signed progress-per-second toward completion, so a flick
 * completes even from low progress and a reverse flick always cancels.
 */
export function shouldCompleteTurn(progress, velocity) {
  if (velocity >= TURN_FLICK_VELOCITY) return true;
  if (velocity <= -TURN_FLICK_VELOCITY) return false;
  return progress >= TURN_COMPLETE_THRESHOLD;
}

/** Settle duration proportional to the distance the sheet still has to travel. */
export function settleDuration(progress, complete) {
  const remaining = complete ? 1 - progress : progress;
  return Math.max(TURN_MIN_SETTLE_MS, Math.round(TURN_DURATION_MS * remaining));
}
