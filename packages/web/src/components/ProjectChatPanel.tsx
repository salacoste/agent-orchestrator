"use client";

import { useState } from "react";

import type { ProjectInsight } from "@/lib/workflow/project-context-aggregator";

interface ProjectChatPanelProps {
  insights: ProjectInsight[];
  onAskQuestion?: (question: string) => void;
}

/**
 * Project chat sidebar panel (Story 25b.4).
 *
 * Shows proactive insights as chat bubbles and a text input for questions.
 * Chat-style layout: messages top, input bottom.
 */
export function ProjectChatPanel({ insights, onAskQuestion }: ProjectChatPanelProps) {
  const [question, setQuestion] = useState("");

  const handleSubmit = () => {
    if (question.trim() && onAskQuestion) {
      onAskQuestion(question.trim());
      setQuestion("");
    }
  };

  return (
    <section
      aria-label="Project chat"
      className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] flex flex-col h-full"
    >
      <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider px-5 pt-4 pb-2">
        Project Chat
      </h2>

      <div className="flex-1 overflow-y-auto px-5 space-y-2" data-testid="chat-messages">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`rounded-lg px-3 py-2 text-[12px] ${
              insight.severity === "action"
                ? "bg-red-500/10 text-red-400"
                : insight.severity === "warning"
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]"
            }`}
            data-testid={`insight-${insight.id}`}
          >
            {insight.text}
          </div>
        ))}
        {insights.length === 0 && (
          <p className="text-[12px] text-[var(--color-text-muted)] italic">
            No insights yet. Ask a question about your project.
          </p>
        )}
      </div>

      <div className="border-t border-[var(--color-border-default)] px-5 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Ask about your project..."
            className="flex-1 text-[12px] bg-[var(--color-bg-hover)] rounded-md px-3 py-2 outline-none placeholder:text-[var(--color-text-muted)]"
            data-testid="chat-input"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!question.trim()}
            className="px-3 py-2 text-[12px] font-semibold rounded-md bg-[var(--color-status-success)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            data-testid="chat-send"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
