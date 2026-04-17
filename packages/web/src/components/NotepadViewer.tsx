"use client";

import { useState } from "react";
import { useNotepadSSE } from "@/hooks/useNotepadSSE";
import { ActivityDot } from "./ActivityDot";

/**
 * Three-tab notepad viewer for agent session detail view.
 * Shows Priority, Working Memory, and Manual sections with real-time SSE updates.
 *
 * Epic 60, Story 60-2 (FR-D1-2).
 */

interface NotepadViewerProps {
  sessionId: string;
}

type TabKey = "priority" | "working" | "manual";

const TABS: { key: TabKey; label: string }[] = [
  { key: "priority", label: "Priority" },
  { key: "working", label: "Working Memory" },
  { key: "manual", label: "Manual" },
];

export function NotepadViewer({ sessionId }: NotepadViewerProps) {
  const { notepad, exists, connected } = useNotepadSSE(sessionId);
  const [activeTab, setActiveTab] = useState<TabKey>("priority");

  const header = (
    <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
      Agent Notepad
      {exists && <ActivityDot activity={connected ? "active" : "idle"} dotOnly size={6} />}
    </h2>
  );

  if (!exists) {
    return (
      <div className="detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5">
        {header}
        <p className="text-[12px] text-[var(--color-text-secondary)]">No notepad content yet.</p>
      </div>
    );
  }

  const content = notepad?.[activeTab] ?? "";

  return (
    <div className="detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5">
      {header}

      {/* Tab bar — SprintBoard underline pattern with design tokens */}
      <div className="flex gap-1 border-b border-[var(--color-border-default)] mb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-[12px] font-semibold transition-colors border-b-2 ${
              activeTab === tab.key
                ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {content.trim() === "" ? (
        <p className="text-[12px] text-[var(--color-text-secondary)]">No content yet.</p>
      ) : (
        <pre className="text-[12px] text-[var(--color-text-primary)] whitespace-pre-wrap font-mono leading-relaxed">
          {content}
        </pre>
      )}
    </div>
  );
}
