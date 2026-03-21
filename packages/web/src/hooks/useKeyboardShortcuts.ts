"use client";

import { useEffect, useCallback, useState } from "react";

import { KEYBOARD_SHORTCUTS } from "@/lib/workflow/keyboard-shortcuts";

/**
 * Keyboard shortcut hook (Story 25b.5).
 *
 * Listens for keyboard shortcuts and dispatches actions.
 * Returns showHelp state for the help modal.
 */
export function useKeyboardShortcuts(onAction: (action: string) => void): {
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
} {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();

      // Single-key shortcuts
      if (key === "?") {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }
      if (key === "n") {
        e.preventDefault();
        onAction("notification:next");
        return;
      }
      if (key === " ") {
        e.preventDefault();
        onAction("approve");
        return;
      }

      // g+X chord shortcuts (press g, then the next key)
      if (key === "g") {
        const handleChord = (e2: KeyboardEvent) => {
          const k2 = e2.key.toLowerCase();
          window.removeEventListener("keydown", handleChord);
          if (k2 === "f") onAction("navigate:fleet");
          else if (k2 === "s") onAction("navigate:sprint");
          else if (k2 === "w") onAction("navigate:workflow");
        };
        window.addEventListener("keydown", handleChord, { once: true });
        // Auto-cleanup after 1 second if no second key
        setTimeout(() => window.removeEventListener("keydown", handleChord), 1000);
      }
    },
    [onAction],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}

/**
 * Re-export shortcuts for the help modal.
 */
export { KEYBOARD_SHORTCUTS };
