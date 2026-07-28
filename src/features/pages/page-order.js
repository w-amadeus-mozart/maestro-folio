export function firstReorderableIndex(pages) {
  const index = pages.findIndex((page) => page.kind === "page");
  return index < 0 ? pages.length : index;
}

export function canReorderPage(pages, index) {
  return index >= firstReorderableIndex(pages) && index < pages.length;
}

export function movePage(pages, fromIndex, toIndex) {
  if (!canReorderPage(pages, fromIndex)) return pages;
  const firstMovable = firstReorderableIndex(pages);
  const destination = Math.max(firstMovable, Math.min(pages.length - 1, toIndex));
  if (fromIndex === destination) return pages;
  const reordered = [...pages];
  const [page] = reordered.splice(fromIndex, 1);
  reordered.splice(destination, 0, page);
  return reordered;
}
