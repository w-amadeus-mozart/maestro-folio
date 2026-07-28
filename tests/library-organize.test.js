import { describe, expect, it } from "vitest";
import { organizeBooks } from "../src/features/library/library-organize.js";

const books = [
  { id: "b", title: "Nocturne", composer: "Chopin", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "a", title: "Clair de lune", composer: "Debussy", updatedAt: "2026-03-01T00:00:00Z" },
  { id: "c", title: "Arabesque", composer: "Debussy", updatedAt: "2026-02-01T00:00:00Z" }
];

describe("library organization", () => {
  it("searches titles and composers without case sensitivity", () => {
    expect(organizeBooks(books, "DEBUSSY").map((book) => book.id)).toEqual(["a", "c"]);
    expect(organizeBooks(books, "noct").map((book) => book.id)).toEqual(["b"]);
  });

  it("sorts by recent update, title, or composer", () => {
    expect(organizeBooks(books).map((book) => book.id)).toEqual(["a", "c", "b"]);
    expect(organizeBooks(books, "", "title").map((book) => book.id)).toEqual(["c", "a", "b"]);
    expect(organizeBooks(books, "", "composer").map((book) => book.id)).toEqual(["b", "c", "a"]);
  });
});
