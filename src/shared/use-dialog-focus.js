import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function useDialogFocus(open, onClose) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const returnFocus = document.activeElement;
    const dialog = dialogRef.current;
    const initial = dialog?.querySelector("[data-dialog-initial-focus]") || dialog?.querySelector(FOCUSABLE);
    requestAnimationFrame(() => initial?.focus());

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE)]
        .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (returnFocus instanceof HTMLElement) requestAnimationFrame(() => returnFocus.focus());
    };
  }, [open, onClose]);

  return dialogRef;
}
