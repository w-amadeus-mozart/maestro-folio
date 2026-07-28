import { normalizePageNumbering } from "../pages/page-numbering.js";
import { normalizeAudioSettings } from "../audio/audio-settings.js";

export const CURRENT_BOOK_SCHEMA_VERSION = 2;

export function spreadToPageId(spread, pages = []) {
  const pageIndex = spread === 0 ? 0 : 1 + (Math.max(1, spread) - 1) * 2;
  return pages[pageIndex]?.id || null;
}

export function pageIdToSpread(pageId, pages = []) {
  const pageIndex = pages.findIndex((page) => page.id === pageId);
  if (pageIndex < 0) return null;
  return pageIndex === 0 ? 0 : Math.ceil(pageIndex / 2);
}

export function migrateLegacyMetadata(legacyBook, {
  pageAssets,
  audioAssetId = null,
  bookmarkAudioAssets = new Map()
}) {
  const legacyPages = legacyBook.pages || [];
  const pageRefs = legacyPages.map((page, index) => ({
    pageId: page.id || crypto.randomUUID(),
    kind: page.kind || (index === 0 ? "cover" : "page"),
    name: page.name || `Page ${index + 1}`,
    assetId: pageAssets[index]?.assetId || null,
    thumbAssetId: null,
    originalPage: page.originalPage ?? null
  }));

  const bookmarks = (legacyBook.bookmarks || []).map((bookmark) => {
    const pageId = bookmark.pageId || spreadToPageId(bookmark.spread ?? 0, pageRefs.map((page) => ({ id: page.pageId })));
    return {
      id: bookmark.id || crypto.randomUUID(),
      name: bookmark.name || "Untitled bookmark",
      pageId,
      orphaned: !pageId,
      audioAssetId: bookmarkAudioAssets.get(bookmark.id) || null,
      audioName: bookmark.audioName || "",
      audioSettings: normalizeAudioSettings(bookmark.audioSettings)
    };
  });

  return {
    id: legacyBook.id,
    schemaVersion: CURRENT_BOOK_SCHEMA_VERSION,
    title: legacyBook.title || "Untitled score",
    composer: legacyBook.composer || "",
    pageRefs,
    pageCount: pageRefs.length,
    bookmarks,
    audioAssetId,
    audioName: legacyBook.audioName || "",
    audioSettings: normalizeAudioSettings(legacyBook.audioSettings),
    pageNumbering: normalizePageNumbering(legacyBook.pageNumbering, legacyBook.showPageNumbers),
    showPageNumbers: Boolean(legacyBook.pageNumbering?.enabled ?? legacyBook.showPageNumbers),
    updatedAt: legacyBook.updatedAt || new Date().toISOString()
  };
}

export function hydrateBookmarkLocation(bookmark, pageRefs) {
  const pages = pageRefs.map((page) => ({ id: page.pageId }));
  const spread = pageIdToSpread(bookmark.pageId, pages);
  return {
    ...bookmark,
    spread: spread ?? 0,
    orphaned: spread === null || Boolean(bookmark.orphaned)
  };
}
