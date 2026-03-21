"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/** An action available in the command palette. */
export interface PaletteAction {
  id: string;
  label: string;
  description?: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  actions: PaletteAction[];
}

/**
 * Command Palette (Cmd+K) — Story 26.1.
 *
 * Global overlay with fuzzy-matching action search.
 * Press Cmd+K (or Ctrl+K) to open, Escape to close.
 */
export function CommandPalette({ actions }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter actions by query (case-insensitive substring match)
  const filtered = query
    ? actions.filter(
        (a) =>
          a.label.toLowerCase().includes(query.toLowerCase()) ||
          (a.description?.toLowerCase().includes(query.toLowerCase()) ?? false),
      )
    : actions;

  // Global Cmd+K / Ctrl+K listener
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      data-testid="command-palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setOpen(false)}
        data-testid="palette-backdrop"
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-2xl">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command..."
          className="w-full px-4 py-3 text-[14px] bg-transparent border-b border-[var(--color-border-default)] outline-none placeholder:text-[var(--color-text-muted)]"
          data-testid="palette-input"
        />

        <ul
          className="max-h-[300px] overflow-y-auto py-2"
          role="listbox"
          data-testid="palette-results"
        >
          {filtered.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-[13px] hover:bg-[var(--color-bg-hover)] transition-colors flex items-center justify-between"
                onClick={() => {
                  action.action();
                  setOpen(false);
                }}
                data-testid={`palette-action-${action.id}`}
              >
                <div>
                  <span className="text-[var(--color-text-primary)]">{action.label}</span>
                  {action.description && (
                    <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">
                      {action.description}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {action.category}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-[12px] text-[var(--color-text-muted)]">
              No matching commands
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
