import { describe, expect, it } from "vitest";
import {
  clampSpread,
  maxSpreadForPageCount,
  pageIndexToSpread,
  readerSpreadLabel,
  spreadPageIndices
} from "../src/features/reader/reader-geometry.js";

describe("reader geometry", () => {
  it("calculates spread limits for cover-only, even, and odd page counts", () => {
    expect(maxSpreadForPageCount(1)).toBe(0);
    expect(maxSpreadForPageCount(6)).toBe(3);
    expect(maxSpreadForPageCount(7)).toBe(3);
  });

  it("maps closed and open spreads to visible page indices", () => {
    expect(spreadPageIndices(0, 6)).toEqual({ spread: 0, leftIndex: 0, rightIndex: null });
    expect(spreadPageIndices(1, 6)).toEqual({ spread: 1, leftIndex: 1, rightIndex: 2 });
    expect(spreadPageIndices(3, 6)).toEqual({ spread: 3, leftIndex: 5, rightIndex: null });
  });

  it("clamps out-of-range spreads and maps page jumps", () => {
    expect(clampSpread(-2, 6)).toBe(0);
    expect(clampSpread(99, 6)).toBe(3);
    expect(pageIndexToSpread(0)).toBe(0);
    expect(pageIndexToSpread(1)).toBe(1);
    expect(pageIndexToSpread(4)).toBe(2);
  });

  it("formats cover and open-spread labels", () => {
    expect(readerSpreadLabel(0, 6)).toBe("Front cover");
    expect(readerSpreadLabel(1, 6)).toBe("Pages 1–2");
    expect(readerSpreadLabel(3, 6)).toBe("Pages 5–5");
    expect(readerSpreadLabel(null, 6)).toBe("Page removed");
  });
});
