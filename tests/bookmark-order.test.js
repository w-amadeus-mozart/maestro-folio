import { describe, expect, it } from "vitest";
import { moveBookmark } from "../src/features/bookmarks/bookmark-order.js";

const bookmarks = [
  { id: "one", name: "One" },
  { id: "two", name: "Two" },
  { id: "three", name: "Three" }
];

describe("bookmark ordering", () => {
  it("moves bookmarks while preserving their stable IDs", () => {
    expect(moveBookmark(bookmarks, 2, 0).map((bookmark) => bookmark.id))
      .toEqual(["three", "one", "two"]);
  });

  it("clamps destinations and leaves invalid moves unchanged", () => {
    expect(moveBookmark(bookmarks, 0, 99).map((bookmark) => bookmark.id))
      .toEqual(["two", "three", "one"]);
    expect(moveBookmark(bookmarks, -1, 1)).toBe(bookmarks);
    expect(moveBookmark(bookmarks, 1, 1)).toBe(bookmarks);
  });
});
