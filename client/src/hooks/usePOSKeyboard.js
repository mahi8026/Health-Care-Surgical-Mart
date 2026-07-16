/**
 * usePOSKeyboard
 *
 * Registers POS keyboard shortcuts for the Sales page.
 *
 * Shortcuts:
 *   F1  — Focus product search input
 *   F2  — Focus customer search
 *   F9  — Hold current sale
 *   F10 — Open checkout / process sale
 *   Esc — Clear cart (with confirmation if items exist)
 *
 * Pass refs and callbacks; the hook attaches/detaches the listener automatically.
 */
import { useEffect } from "react";

export function usePOSKeyboard({
  searchInputRef,
  customerSearchRef,
  onHold,
  onCheckout,
  onClear,
  cartLength = 0,
  disabled = false,
}) {
  useEffect(() => {
    if (disabled) return;

    const handler = (e) => {
      // Don't fire shortcuts when user is typing in a regular input/textarea
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select";

      // Don't fire shortcuts when user is typing in a regular input/textarea
      if (isTyping) return;

      switch (e.key) {
        case "F1":
          e.preventDefault();
          searchInputRef?.current?.focus();
          break;

        case "F2":
          e.preventDefault();
          customerSearchRef?.current?.focus();
          break;

        case "F9":
          e.preventDefault();
          onHold?.();
          break;

        case "F10":
          e.preventDefault();
          onCheckout?.();
          break;

        case "Escape":
          if (!isTyping) {
            e.preventDefault();
            if (cartLength > 0) {
              if (window.confirm(`Clear cart? This will remove ${cartLength} item(s).`)) {
                onClear?.();
              }
            }
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchInputRef, customerSearchRef, onHold, onCheckout, onClear, cartLength, disabled]);
}
