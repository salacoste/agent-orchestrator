"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  onClose?: () => void;
  /** Initial left pane width percentage (default: 50). */
  initialSplit?: number;
  /** Minimum pane width in pixels (default: 200). */
  minWidth?: number;
}

/**
 * Resizable split pane layout (Story 44.2).
 *
 * Renders two panes side by side with a draggable divider.
 * Close button returns to single-pane view.
 */
export function SplitPane({
  left,
  right,
  onClose,
  initialSplit = 50,
  minWidth = 200,
}: SplitPaneProps) {
  const [splitPercent, setSplitPercent] = useState(initialSplit);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Track active drag listeners for cleanup on unmount
  const cleanupRef = useRef<(() => void) | null>(null);

  const handleMouseDown = useCallback(() => {
    dragging.current = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0) return; // Guard against zero-width container
      const x = e.clientX - rect.left;
      const percent = Math.max(
        (minWidth / rect.width) * 100,
        Math.min(100 - (minWidth / rect.width) * 100, (x / rect.width) * 100),
      );
      setSplitPercent(percent);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      cleanupRef.current = null;
    };

    // Store cleanup so unmount can remove listeners
    cleanupRef.current = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [minWidth]);

  // Clean up dangling drag listeners on unmount
  useEffect(
    () => () => {
      cleanupRef.current?.();
    },
    [],
  );

  return (
    <div ref={containerRef} className="flex h-full relative" data-testid="split-pane">
      {/* Left pane */}
      <div
        className="overflow-auto"
        style={{ width: `${splitPercent}%` }}
        data-testid="split-pane-left"
      >
        {left}
      </div>

      {/* Drag handle */}
      <div
        className="w-1 bg-[var(--color-border-default)] cursor-col-resize hover:bg-blue-500 transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown}
        data-testid="split-pane-handle"
        role="separator"
        aria-orientation="vertical"
      />

      {/* Right pane */}
      <div className="overflow-auto flex-1" data-testid="split-pane-right">
        <div className="relative">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-2 right-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] z-10 text-[16px]"
              data-testid="split-pane-close"
              aria-label="Close split view"
            >
              ✕
            </button>
          )}
          {right}
        </div>
      </div>
    </div>
  );
}
