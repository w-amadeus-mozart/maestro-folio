import { describe, expect, it } from "vitest";
import { destroyPdfLoadingTask, orderPdfPages } from "../src/features/importer/use-pdf-import.js";
import {
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  validateImageFiles,
  validatePdfFile,
  validatePdfPageCount
} from "../src/features/importer/upload-files.js";

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

describe("PDF reader cleanup", () => {
  it("destroys the loading task once when completion and cancellation overlap", async () => {
    let calls = 0;
    const task = { destroy: async () => { calls += 1; } };
    await Promise.all([destroyPdfLoadingTask(task), destroyPdfLoadingTask(task)]);
    expect(calls).toBe(1);
  });

  it("reports an incompatible loading task clearly", async () => {
    await expect(destroyPdfLoadingTask({})).rejects.toThrow("could not release this file safely");
  });
});

describe("score upload validation", () => {
  it("accepts supported images and PDFs", () => {
    const image = { name: "page.png", type: "image/png", size: 1024 };
    const pdf = { name: "score.pdf", type: "application/pdf", size: 2048 };
    expect(validateImageFiles([image])).toEqual([image]);
    expect(validatePdfFile(pdf)).toBe(pdf);
  });

  it("rejects unsupported and oversized images before changing the book", () => {
    expect(() => validateImageFiles([{ name: "notes.txt", type: "text/plain", size: 10 }]))
      .toThrow("not a supported image");
    expect(() => validateImageFiles([{ name: "scan.png", type: "image/png", size: MAX_IMAGE_BYTES + 1 }]))
      .toThrow("exceeds the 20 MB image limit");
  });

  it("rejects oversized PDFs and unsafe page counts", () => {
    expect(() => validatePdfFile({ name: "score.pdf", type: "application/pdf", size: MAX_PDF_BYTES + 1 }))
      .toThrow("PDF files must be 50 MB or smaller.");
    expect(() => validatePdfPageCount(201)).toThrow("Import up to 200 pages at a time.");
    expect(() => validatePdfPageCount(0)).toThrow("does not contain any readable pages");
  });
});
