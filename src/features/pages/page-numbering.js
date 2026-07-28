export const DEFAULT_PAGE_NUMBERING = Object.freeze({
  enabled: false,
  startAt: 1,
  every: 1,
  position: "bottom",
  alignment: "outer"
});

const integerInRange = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};

export function normalizePageNumbering(settings, legacyEnabled = false) {
  return {
    enabled: settings?.enabled ?? Boolean(legacyEnabled),
    startAt: integerInRange(settings?.startAt, 1, 0, 9999),
    every: integerInRange(settings?.every, 1, 1, 99),
    position: settings?.position === "top" ? "top" : "bottom",
    alignment: ["outer", "inner", "center"].includes(settings?.alignment)
      ? settings.alignment
      : "outer"
  };
}

export function pageNumberForIndex(pages, pageIndex, settings) {
  const normalized = normalizePageNumbering(settings);
  if (!normalized.enabled || pages[pageIndex]?.kind !== "page") return null;
  const musicIndex = pages.slice(0, pageIndex + 1).filter((page) => page.kind === "page").length - 1;
  if (musicIndex < 0 || musicIndex % normalized.every !== 0) return null;
  return normalized.startAt + musicIndex;
}

export function pageNumberClass(side, settings) {
  const normalized = normalizePageNumbering(settings);
  const horizontal = normalized.alignment === "center"
    ? "center"
    : normalized.alignment === "outer"
      ? (side === "left" ? "left" : "right")
      : (side === "left" ? "right" : "left");
  return `page-no ${normalized.position} ${horizontal}`;
}
