import { describe, expect, it } from "vitest";
import {
  clampSpread,
  maxSpreadForPageCount,
  pageIndexToSpread,
  readerSpreadLabel,
  spreadPageIndices
} from "../src/features/reader/reader-geometry.js";
import { canReorderPage, firstReorderableIndex, movePage } from "../src/features/pages/page-order.js";
import {
  normalizePageNumbering,
  pageNumberClass,
  pageNumberForIndex
} from "../src/features/pages/page-numbering.js";

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

describe("page numbering", () => {
  const pages = [
    { id: "cover", kind: "cover" },
    { id: "index", kind: "index" },
    { id: "one", kind: "page" },
    { id: "two", kind: "page" },
    { id: "three", kind: "page" }
  ];

  it("normalizes legacy and out-of-range settings", () => {
    expect(normalizePageNumbering(null, true)).toMatchObject({ enabled: true, startAt: 1, every: 1 });
    expect(normalizePageNumbering({ enabled: true, startAt: -4, every: 500 }))
      .toMatchObject({ startAt: 0, every: 99, position: "bottom", alignment: "outer" });
  });

  it("excludes cover/index and numbers music pages from a custom start", () => {
    const settings = { enabled: true, startAt: 7, every: 1 };
    expect(pageNumberForIndex(pages, 0, settings)).toBeNull();
    expect(pageNumberForIndex(pages, 1, settings)).toBeNull();
    expect(pageNumberForIndex(pages, 2, settings)).toBe(7);
    expect(pageNumberForIndex(pages, 4, settings)).toBe(9);
  });

  it("supports every-Nth numbering and inner/outer placement", () => {
    const settings = { enabled: true, startAt: 7, every: 2, position: "top", alignment: "inner" };
    expect(pageNumberForIndex(pages, 2, settings)).toBe(7);
    expect(pageNumberForIndex(pages, 3, settings)).toBeNull();
    expect(pageNumberForIndex(pages, 4, settings)).toBe(9);
    expect(pageNumberClass("left", settings)).toBe("page-no top right");
    expect(pageNumberClass("right", settings)).toBe("page-no top left");
  });
});

describe("page ordering", () => {
  const pages = [
    { id: "cover", kind: "cover" },
    { id: "index", kind: "index" },
    { id: "one", kind: "page" },
    { id: "two", kind: "page" },
    { id: "three", kind: "page" }
  ];

  it("keeps cover and index positions pinned", () => {
    expect(firstReorderableIndex(pages)).toBe(2);
    expect(canReorderPage(pages, 0)).toBe(false);
    expect(movePage(pages, 0, 3)).toBe(pages);
  });

  it("moves music pages without changing their stable IDs", () => {
    const reordered = movePage(pages, 4, 2);
    expect(reordered.map((page) => page.id)).toEqual(["cover", "index", "three", "one", "two"]);
    expect(reordered[0].kind).toBe("cover");
    expect(reordered[1].kind).toBe("index");
  });

  it("clamps music page destinations after pinned pages", () => {
    expect(movePage(pages, 4, 0).map((page) => page.id))
      .toEqual(["cover", "index", "three", "one", "two"]);
  });
});
