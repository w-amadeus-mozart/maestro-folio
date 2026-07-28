export function maxSpreadForPageCount(pageCount) {
  return Math.max(0, Math.ceil((Math.max(0, pageCount) - 1) / 2));
}

export function clampSpread(spread, pageCount) {
  return Math.max(0, Math.min(maxSpreadForPageCount(pageCount), spread));
}

export function spreadPageIndices(spread, pageCount) {
  const safeSpread = clampSpread(spread, pageCount);
  const leftIndex = safeSpread === 0 ? 0 : 1 + (safeSpread - 1) * 2;
  const candidateRight = safeSpread === 0 ? null : leftIndex + 1;
  return {
    spread: safeSpread,
    leftIndex,
    rightIndex: candidateRight !== null && candidateRight < pageCount ? candidateRight : null
  };
}

export function pageIndexToSpread(pageIndex) {
  return pageIndex <= 0 ? 0 : Math.ceil(pageIndex / 2);
}

export function readerSpreadLabel(spread, pageCount) {
  if (spread === null) return "Page removed";
  if (spread === 0) return "Front cover";
  const first = 1 + (spread - 1) * 2;
  const last = Math.min(Math.max(0, pageCount - 1), 2 + (spread - 1) * 2);
  return `Pages ${first}–${last}`;
}
