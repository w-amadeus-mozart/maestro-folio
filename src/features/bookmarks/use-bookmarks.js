import { useCallback, useMemo, useState } from "react";
import { pageIdToSpread, spreadToPageId } from "../books/book-migrations.js";
import { readAudioFile } from "../audio/audio-files.js";
import { moveBookmark } from "./bookmark-order.js";
import { DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings } from "../audio/audio-settings.js";

export function useBookmarks({ pages, spread, maxSpread, setSpread, setSaved }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [activeBookmarkId, setActiveBookmarkId] = useState(null);
  const [bookmarkDraft, setBookmarkDraft] = useState(null);
  const [bookmarkAudioError, setBookmarkAudioError] = useState("");

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
    setBookmarkAudioError("");
  }, []);

  const clearActiveBookmark = useCallback(() => setActiveBookmarkId(null), []);

  const openBookmarkCreator = useCallback(() => {
    setBookmarkAudioError("");
    setBookmarkDraft({
      id: crypto.randomUUID(),
      name: `Piece ${bookmarks.length + 1}`,
      pageId: spreadToPageId(spread, pages),
      spread,
      audioSrc: "",
      audioName: "",
      audioSettings: DEFAULT_AUDIO_SETTINGS,
      mode: "create"
    });
  }, [bookmarks.length, pages, spread]);

  const closeBookmarkCreator = useCallback(() => {
    setBookmarkDraft(null);
    setBookmarkAudioError("");
  }, []);

  const renameBookmarkDraft = useCallback((name) => {
    setBookmarkDraft((current) => current ? { ...current, name } : current);
  }, []);

  const openBookmarkEditor = useCallback((bookmark) => {
    setBookmarkAudioError("");
    setBookmarkDraft({
      ...bookmark,
      spread: resolveBookmarkSpread(bookmark) ?? 0,
      mode: "edit"
    });
  }, [resolveBookmarkSpread]);

  const retargetBookmarkDraft = useCallback(() => {
    setBookmarkDraft((current) => current ? {
      ...current,
      pageId: spreadToPageId(spread, pages),
      spread
    } : current);
  }, [pages, spread]);

  const removeBookmarkDraftAudio = useCallback(() => {
    setBookmarkDraft((current) => current ? {
      ...current,
      audioSrc: "",
      audioName: "",
      audioAssetId: null
    } : current);
    setBookmarkAudioError("");
  }, []);

  const attachBookmarkAudio = useCallback(async (file) => {
    setBookmarkAudioError("");
    try {
      const src = await readAudioFile(file);
      setBookmarkDraft((current) => current ? {
        ...current,
        audioSrc: src,
        audioName: file.name,
        audioAssetId: null
      } : current);
      return true;
    } catch (error) {
      setBookmarkAudioError(error?.message || "The audio file could not be loaded.");
      return false;
    }
  }, []);

  const confirmBookmark = useCallback(() => {
    if (!bookmarkDraft?.name.trim()) return;
    const { mode, ...bookmark } = { ...bookmarkDraft, name: bookmarkDraft.name.trim() };
    setBookmarks((current) => mode === "edit"
      ? current.map((item) => item.id === bookmark.id ? bookmark : item)
      : [...current, bookmark]);
    setActiveBookmarkId(bookmark.id);
    setBookmarkDraft(null);
    setSaved(false);
  }, [bookmarkDraft, setSaved]);

  const reorderBookmarks = useCallback((fromIndex, toIndex) => {
    setBookmarks((current) => moveBookmark(current, fromIndex, toIndex));
    setSaved(false);
  }, [setSaved]);

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
    setBookmarkAudioError("");
    try {
      const src = await readAudioFile(file);
      setBookmarks((current) => current.map((bookmark) => bookmark.id === activeBookmark.id
        ? { ...bookmark, audioSrc: src, audioName: file.name, audioAssetId: null }
        : bookmark));
      setSaved(false);
      return true;
    } catch (error) {
      setBookmarkAudioError(error?.message || "The audio file could not be loaded.");
      return false;
    }
  }, [activeBookmark, setSaved]);

  const updateActiveBookmarkAudioSettings = useCallback((settings) => {
    if (!activeBookmark) return;
    setBookmarks((current) => current.map((bookmark) => bookmark.id === activeBookmark.id
      ? { ...bookmark, audioSettings: normalizeAudioSettings(settings) }
      : bookmark));
    setSaved(false);
  }, [activeBookmark, setSaved]);

  return {
    bookmarks,
    activeBookmarkId,
    activeBookmark,
    bookmarkDraft,
    bookmarkAudioError,
    resolveBookmarkSpread,
    resetBookmarks,
    clearActiveBookmark,
    openBookmarkCreator,
    closeBookmarkCreator,
    renameBookmarkDraft,
    openBookmarkEditor,
    retargetBookmarkDraft,
    removeBookmarkDraftAudio,
    attachBookmarkAudio,
    confirmBookmark,
    openBookmark,
    deleteBookmark,
    reorderBookmarks,
    replaceActiveBookmarkAudio,
    updateActiveBookmarkAudioSettings
  };
}
