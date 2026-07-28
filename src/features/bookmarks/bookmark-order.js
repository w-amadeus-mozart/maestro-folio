export function moveBookmark(bookmarks, fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= bookmarks.length) return bookmarks;
  const destination = Math.max(0, Math.min(bookmarks.length - 1, toIndex));
  if (destination === fromIndex) return bookmarks;
  const reordered = [...bookmarks];
  const [bookmark] = reordered.splice(fromIndex, 1);
  reordered.splice(destination, 0, bookmark);
  return reordered;
}
