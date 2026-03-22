"use client";

import { useState } from "react";
import type { Annotation } from "@/lib/workflow/collaboration";

interface ArtifactAnnotationProps {
  artifactId: string;
  annotations: Annotation[];
  onAdd?: (annotation: { artifactId: string; author: string; text: string }) => void;
  currentUser?: string;
}

/**
 * Inline artifact annotation component (Story 42.1).
 *
 * Shows existing annotations and an expandable input for adding new ones.
 */
export function ArtifactAnnotation({
  artifactId,
  annotations,
  onAdd,
  currentUser = "Anonymous",
}: ArtifactAnnotationProps) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || !onAdd) return;
    onAdd({ artifactId, author: currentUser, text: trimmed });
    setText("");
    setExpanded(false);
  };

  return (
    <div className="space-y-2" data-testid={`annotations-${artifactId}`}>
      {annotations.map((a) => (
        <div
          key={a.id}
          className="rounded px-3 py-2 bg-[var(--color-bg-hover)] text-[11px]"
          data-testid={`annotation-${a.id}`}
        >
          <span className="font-semibold text-[var(--color-text-primary)]">{a.author}</span>
          <span className="text-[var(--color-text-muted)] ml-2">
            {new Date(a.timestamp).toLocaleString()}
          </span>
          <p className="text-[var(--color-text-secondary)] mt-1">{a.text}</p>
        </div>
      ))}

      {!expanded && onAdd && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          data-testid="add-annotation-button"
        >
          + Add comment
        </button>
      )}

      {expanded && (
        <div className="flex gap-2" data-testid="annotation-input">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Add a comment..."
            className="flex-1 text-[11px] bg-[var(--color-bg-hover)] rounded px-3 py-1.5 outline-none"
            data-testid="annotation-text-input"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="px-3 py-1.5 text-[11px] font-semibold rounded bg-[var(--color-status-success)] text-white disabled:opacity-40"
            data-testid="annotation-submit"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              setText("");
            }}
            className="px-2 py-1.5 text-[11px] text-[var(--color-text-muted)]"
            data-testid="annotation-cancel"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
