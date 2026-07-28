import { describe, expect, it } from "vitest";
import {
  TURN_COMPLETE_THRESHOLD,
  TURN_DURATION_MS,
  TURN_MIN_SETTLE_MS,
  dragProgress,
  settleDuration,
  shouldCompleteTurn,
  turnAngle,
  turnPageIndices,
  turnShade
} from "../src/features/reader/reader-turn.js";

describe("turn page indices", () => {
  it("resolves a forward turn between interior spreads", () => {
    // 7 pages, spread 1 (pages 1,2) -> spread 2 (pages 3,4)
    expect(turnPageIndices(1, 2, 7)).toEqual({
      staticLeftIndex: 1,
      sheetFrontIndex: 2,
      sheetBackIndex: 3,
      staticRightIndex: 4
    });
  });

  it("uses the same indices regardless of direction", () => {
    expect(turnPageIndices(2, 1, 7)).toEqual(turnPageIndices(1, 2, 7));
  });

  it("opens the front cover with the board exposed on the left", () => {
    expect(turnPageIndices(0, 1, 6)).toEqual({
      staticLeftIndex: null,
      sheetFrontIndex: 0,
      sheetBackIndex: 1,
      staticRightIndex: 2
    });
  });

  it("turns onto an odd final spread with a blank right side", () => {
    // 6 pages, spread 2 (pages 3,4) -> spread 3 (page 5 only)
    expect(turnPageIndices(2, 3, 6)).toEqual({
      staticLeftIndex: 3,
      sheetFrontIndex: 4,
      sheetBackIndex: 5,
      staticRightIndex: null
    });
  });
});

describe("drag geometry", () => {
  it("maps leftward drags to next-turn progress and clamps to [0,1]", () => {
    expect(dragProgress(500, 500, 400, "next")).toBe(0);
    expect(dragProgress(500, 300, 400, "next")).toBeCloseTo(0.575, 3);
    expect(dragProgress(500, -900, 400, "next")).toBe(1);
    expect(dragProgress(500, 700, 400, "next")).toBe(0); // wrong direction
  });

  it("maps rightward drags to prev-turn progress", () => {
    expect(dragProgress(100, 300, 400, "prev")).toBeCloseTo(0.575, 3);
    expect(dragProgress(100, 0, 400, "prev")).toBe(0);
  });

  it("rotates the sheet from the correct side for each direction", () => {
    expect(turnAngle(0, "next")).toBe(-0);
    expect(turnAngle(1, "next")).toBe(-180);
    expect(turnAngle(0, "prev")).toBe(-180);
    expect(turnAngle(1, "prev")).toBe(-0);
  });

  it("peaks the shade when the sheet is edge-on", () => {
    expect(turnShade(0)).toBeCloseTo(0);
    expect(turnShade(0.5)).toBeCloseTo(0.55, 5);
    expect(turnShade(1)).toBeCloseTo(0);
  });
});

describe("release decisions", () => {
  it("completes past the halfway threshold and falls back before it", () => {
    expect(shouldCompleteTurn(TURN_COMPLETE_THRESHOLD + 0.01, 0)).toBe(true);
    expect(shouldCompleteTurn(TURN_COMPLETE_THRESHOLD - 0.01, 0)).toBe(false);
  });

  it("lets a flick complete from low progress and a reverse flick cancel", () => {
    expect(shouldCompleteTurn(0.1, 2)).toBe(true);
    expect(shouldCompleteTurn(0.9, -2)).toBe(false);
  });

  it("sizes the settle animation to the remaining travel", () => {
    expect(settleDuration(0, true)).toBe(TURN_DURATION_MS);
    expect(settleDuration(0.6, true)).toBe(Math.round(TURN_DURATION_MS * 0.4));
    expect(settleDuration(0.75, false)).toBe(Math.round(TURN_DURATION_MS * 0.75));
    expect(settleDuration(0.99, true)).toBe(TURN_MIN_SETTLE_MS);
  });
});
