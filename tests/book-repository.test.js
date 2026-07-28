import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetRepositoryForTests,
  deleteBook,
  exportBookPackage,
  importBookPackage,
  listBookSummaries,
  loadBook,
  revokeObjectUrls,
  saveBook
} from "../src/features/books/book-repository.js";

const image = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=";
const audio = "data:audio/mpeg;base64,AA==";

function deleteDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("maestro-folio");
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
}

function seedLegacyBook() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("maestro-folio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("books", { keyPath: "id" });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("books", "readwrite");
      transaction.objectStore("books").put({
        id: "legacy",
        title: "Legacy",
        pages: [
          { id: "cover", kind: "cover", name: "Cover", src: image },
          { id: "piece", kind: "page", name: "Piece", src: image }
        ],
        bookmarks: [{ id: "mark", name: "Piece", spread: 1, audioSrc: audio, audioName: "piece.mp3" }]
      });
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

beforeEach(async () => {
  await __resetRepositoryForTests();
  await deleteDatabase();
});

describe("book repository", () => {
  it("stores media as Blob assets and hydrates usable object URLs", async () => {
    await saveBook({
      id: "book-1",
      title: "Blob score",
      composer: "Composer",
      pages: [
        { id: "cover", kind: "cover", name: "Cover", src: image },
        { id: "piece", kind: "page", name: "Piece", src: image }
      ],
      audioSrc: audio,
      audioName: "book.mp3",
      bookmarks: [{ id: "b1", name: "Piece", spread: 1, audioSrc: audio, audioName: "piece.mp3" }]
    });

    const loaded = await loadBook("book-1");
    expect(loaded.pages).toHaveLength(2);
    expect(loaded.pages[0].src).toMatch(/^blob:/);
    expect(loaded.audioSrc).toMatch(/^blob:/);
    expect(loaded.bookmarks[0]).toMatchObject({ pageId: "piece", spread: 1, orphaned: false });

    const { books, objectUrls } = await listBookSummaries();
    expect(books[0]).toMatchObject({ id: "book-1", pageCount: 2 });
    revokeObjectUrls([...loaded._objectUrls, ...objectUrls]);
  });

  it("upgrades an existing v1 record without losing pages or bookmarks", async () => {
    await seedLegacyBook();
    const { books, objectUrls } = await listBookSummaries();
    expect(books).toHaveLength(1);

    const loaded = await loadBook("legacy");
    expect(loaded.pages.map((page) => page.id)).toEqual(["cover", "piece"]);
    expect(loaded.bookmarks[0]).toMatchObject({ pageId: "piece", spread: 1, audioName: "piece.mp3" });
    revokeObjectUrls([...loaded._objectUrls, ...objectUrls]);
  });

  it("deletes a book and its library entry", async () => {
    await saveBook({
      id: "delete-me",
      title: "Delete",
      pages: [{ id: "cover", kind: "cover", name: "Cover", src: image }],
      bookmarks: []
    });
    await deleteBook("delete-me");
    const { books, objectUrls } = await listBookSummaries();
    expect(books).toHaveLength(0);
    revokeObjectUrls(objectUrls);
    await expect(loadBook("delete-me")).rejects.toThrow("could not be found");
  });

  it("exports and imports a complete book as a new local copy", async () => {
    await saveBook({
      id: "portable-book",
      title: "Portable score",
      composer: "Composer",
      pages: [
        { id: "cover", kind: "cover", name: "Cover", src: image },
        { id: "piece", kind: "page", name: "Piece", src: image }
      ],
      audioSrc: audio,
      audioName: "book.mp3",
      pageNumbering: { enabled: true, startAt: 7, every: 2, position: "top", alignment: "inner" },
      bookmarks: [{ id: "mark", name: "Piece", pageId: "piece", audioSrc: audio, audioName: "piece.mp3" }]
    });

    const exported = await exportBookPackage("portable-book");
    expect(exported.fileName).toBe("portable-score.maestro-folio");
    expect(exported.blob.type).toBe("application/vnd.maestro-folio.book+json");

    const imported = await importBookPackage(exported.blob);
    expect(imported).toMatchObject({ title: "Portable score" });
    expect(imported.id).not.toBe("portable-book");

    const loaded = await loadBook(imported.id);
    expect(loaded.pages.map((page) => page.id)).toEqual(["cover", "piece"]);
    expect(loaded.audioSrc).toMatch(/^blob:/);
    expect(loaded.pageNumbering).toEqual({
      enabled: true,
      startAt: 7,
      every: 2,
      position: "top",
      alignment: "inner"
    });
    expect(loaded.bookmarks[0]).toMatchObject({
      name: "Piece",
      pageId: "piece",
      spread: 1,
      audioName: "piece.mp3"
    });
    expect(loaded.bookmarks[0].audioSrc).toMatch(/^blob:/);
    revokeObjectUrls(loaded._objectUrls);

    const { books, objectUrls } = await listBookSummaries();
    expect(books).toHaveLength(2);
    revokeObjectUrls(objectUrls);
  });

  it("rejects invalid or incomplete package files without creating a book", async () => {
    await expect(importBookPackage(new Blob(["not-json"]))).rejects.toThrow("not a valid");
    await expect(importBookPackage(new Blob([JSON.stringify({
      format: "maestro-folio-book",
      packageVersion: 1,
      book: {
        title: "Broken score",
        pageRefs: [{ pageId: "cover", assetId: "missing" }]
      },
      assets: []
    })]))).rejects.toThrow("missing a referenced media asset");

    const { books, objectUrls } = await listBookSummaries();
    expect(books).toHaveLength(0);
    revokeObjectUrls(objectUrls);
  });
});
