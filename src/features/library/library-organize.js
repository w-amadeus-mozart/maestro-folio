export const LIBRARY_SORTS = Object.freeze({
  recent: "Recently updated",
  title: "Title",
  composer: "Composer"
});

export function organizeBooks(books, query = "", sort = "recent") {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery
    ? books.filter((book) => `${book.title || ""} ${book.composer || ""}`.toLocaleLowerCase().includes(normalizedQuery))
    : [...books];

  return filtered.sort((left, right) => {
    if (sort === "title") return (left.title || "").localeCompare(right.title || "", undefined, { sensitivity: "base" });
    if (sort === "composer") {
      return (left.composer || "").localeCompare(right.composer || "", undefined, { sensitivity: "base" })
        || (left.title || "").localeCompare(right.title || "", undefined, { sensitivity: "base" });
    }
    return Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0);
  });
}
