import { describe, expect, it } from "vitest";
import { orderPdfPages } from "../src/features/importer/use-pdf-import.js";

const pages = [
  { id: "one", name: "Score · page 1", src: "page-1" },
  { id: "two", name: "Score · page 2", src: "page-2" },
  { id: "three", name: "Score · page 3", src: "page-3" },
  { id: "four", name: "Score · page 4", src: "page-4" }
];

describe("PDF page role ordering", () => {
  it("moves the selected cover and index ahead of remaining pages", () => {
    const ordered = orderPdfPages(pages, 2, 0);
    expect(ordered.map((page) => page.id)).toEqual(["three", "one", "two", "four"]);
    expect(ordered.map((page) => page.kind)).toEqual(["cover", "index", "page", "page"]);
    expect(ordered[0].name).toBe("Score · page 3 · cover");
    expect(ordered[1].name).toBe("Score · page 1 · index");
  });

  it("preserves remaining source order when no index is selected", () => {
    const ordered = orderPdfPages(pages, 1, -1);
    expect(ordered.map((page) => page.id)).toEqual(["two", "one", "three", "four"]);
    expect(ordered.map((page) => page.kind)).toEqual(["cover", "page", "page", "page"]);
  });

  it("returns no pages when the selected cover is unavailable", () => {
    expect(orderPdfPages(pages, 99, -1)).toEqual([]);
  });
});
