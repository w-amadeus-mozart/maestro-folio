import { describe, expect, it } from "vitest";
import {
  CURRENT_BOOK_SCHEMA_VERSION,
  hydrateBookmarkLocation,
  migrateLegacyMetadata,
  pageIdToSpread,
  spreadToPageId
} from "../src/features/books/book-migrations.js";

const pages = [
  { id: "cover" },
  { id: "index" },
  { id: "music-1" },
  { id: "music-2" },
  { id: "music-3" }
];

describe("reader location migration", () => {
  it("maps spreads to stable left-page IDs", () => {
    expect(spreadToPageId(0, pages)).toBe("cover");
    expect(spreadToPageId(1, pages)).toBe("index");
    expect(spreadToPageId(2, pages)).toBe("music-2");
  });

  it("derives spreads from stable page IDs after insertion", () => {
    expect(pageIdToSpread("music-2", pages)).toBe(2);
    const withInsertion = [pages[0], { id: "insert-a" }, { id: "insert-b" }, ...pages.slice(1)];
    expect(pageIdToSpread("music-2", withInsertion)).toBe(3);
    expect(pageIdToSpread("missing", pages)).toBeNull();
  });

  it("marks a bookmark orphaned when its page no longer exists", () => {
    const bookmark = hydrateBookmarkLocation({ id: "b1", pageId: "removed" }, pages.map((page) => ({ pageId: page.id })));
    expect(bookmark.orphaned).toBe(true);
    expect(bookmark.spread).toBe(0);
  });
});

describe("legacy metadata migration", () => {
  it("converts a v1 spread bookmark into the v2 page-ID shape", () => {
    const legacy = {
      id: "legacy-book",
      title: "Legacy score",
      showPageNumbers: true,
      pages: pages.map((page, index) => ({ ...page, name: `Page ${index}`, kind: index === 0 ? "cover" : "page" })),
      bookmarks: [{ id: "bookmark-1", name: "Piece", spread: 2, audioName: "piece.mp3" }]
    };
    const pageAssets = pages.map((_, index) => ({ assetId: `asset-${index}` }));
    const migrated = migrateLegacyMetadata(legacy, {
      pageAssets,
      bookmarkAudioAssets: new Map([["bookmark-1", "bookmark-audio"]])
    });

    expect(migrated.schemaVersion).toBe(CURRENT_BOOK_SCHEMA_VERSION);
    expect(migrated.pageRefs).toHaveLength(5);
    expect(migrated.bookmarks[0]).toMatchObject({
      pageId: "music-2",
      audioAssetId: "bookmark-audio",
      orphaned: false,
      audioSettings: { playbackRate: 1, loopEnabled: false, loopStart: 0, loopEnd: null }
    });
    expect(migrated.audioSettings).toEqual({
      playbackRate: 1,
      loopEnabled: false,
      loopStart: 0,
      loopEnd: null
    });
    expect(migrated.pages).toBeUndefined();
    expect(migrated.pageNumbering).toEqual({
      enabled: true,
      startAt: 1,
      every: 1,
      position: "bottom",
      alignment: "outer"
    });
  });
});
