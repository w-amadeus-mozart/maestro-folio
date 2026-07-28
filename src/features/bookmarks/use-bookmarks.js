import { useCallback, useMemo, useState } from "react";
import { pageIdToSpread, spreadToPageId } from "../books/book-migrations.js";

const readFile = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(file);
});

export function useBookmarks({ pages, spread, maxSpread, setSpread, setSaved }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [activeBookmarkId, setActiveBookmarkId] = useState(null);
  const [bookmarkDraft, setBookmarkDraft] = useState(null);

  const activeBookmark = useMemo(
    () => bookmarks.find((bookmark) => bookmark.id === activeBookmarkId) || null,
    [activeBookmarkId, bookmarks]
  );

  const resolveBookmarkSpread = useCallback((bookmark) => {
    if (!bookmark) return null;
    if (bookmark.pageId) return pageIdToSpread(bookmark.pageId, pages);
    return bookmark.spread ?? null;
  }, [pages]);

  const resetBookmarks = useCallback((storedBookmarks = []) => {
    setBookmarks(storedBookmarks);
    setActiveBookmarkId(null);
    setBookmarkDraft(null);
  }, []);

  const clearActiveBookmark = useCallback(() => setActiveBookmarkId(null), []);

  const openBookmarkCreator = useCallback(() => {
    setBookmarkDraft({
      id: crypto.randomUUID(),
      name: `Piece ${bookmarks.length + 1}`,
      pageId: spreadToPageId(spread, pages),
      spread,
      audioSrc: "",
      audioName: ""
    });
  }, [bookmarks.length, pages, spread]);

  const closeBookmarkCreator = useCallback(() => setBookmarkDraft(null), []);

  const renameBookmarkDraft = useCallback((name) => {
    setBookmarkDraft((current) => current ? { ...current, name } : current);
  }, []);

  const attachBookmarkAudio = useCallback(async (file) => {
    const src = await readFile(file);
    setBookmarkDraft((current) => current ? { ...current, audioSrc: src, audioName: file.name } : current);
  }, []);

  const confirmBookmark = useCallback(() => {
    if (!bookmarkDraft?.name.trim()) return;
    const bookmark = { ...bookmarkDraft, name: bookmarkDraft.name.trim() };
    setBookmarks((current) => [...current, bookmark]);
    setActiveBookmarkId(bookmark.id);
    setBookmarkDraft(null);
    setSaved(false);
  }, [bookmarkDraft, setSaved]);

  const openBookmark = useCallback((bookmark) => {
    const destination = resolveBookmarkSpread(bookmark);
    if (destination === null) return;
    setSpread(Math.max(0, Math.min(maxSpread, destination)));
    setActiveBookmarkId(bookmark.id);
  }, [maxSpread, resolveBookmarkSpread, setSpread]);

  const deleteBookmark = useCallback((id) => {
    setBookmarks((current) => current.filter((bookmark) => bookmark.id !== id));
    setActiveBookmarkId((current) => current === id ? null : current);
    setSaved(false);
  }, [setSaved]);

  const replaceActiveBookmarkAudio = useCallback(async (file) => {
    if (!activeBookmark) return false;
    const src = await readFile(file);
    setBookmarks((current) => current.map((bookmark) => bookmark.id === activeBookmark.id
      ? { ...bookmark, audioSrc: src, audioName: file.name, audioAssetId: null }
      : bookmark));
    setSaved(false);
    return true;
  }, [activeBookmark, setSaved]);

  return {
    bookmarks,
    activeBookmarkId,
    activeBookmark,
    bookmarkDraft,
    resolveBookmarkSpread,
    resetBookmarks,
    clearActiveBookmark,
    openBookmarkCreator,
    closeBookmarkCreator,
    renameBookmarkDraft,
    attachBookmarkAudio,
    confirmBookmark,
    openBookmark,
    deleteBookmark,
    replaceActiveBookmarkAudio
  };
}
