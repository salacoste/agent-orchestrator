"use client";

import { useState } from "react";

interface CreateStoryFormProps {
  projectId: string;
  onCreated?: () => void;
}

export function CreateStoryForm({ projectId, onCreated }: CreateStoryFormProps) {
  const [title, setTitle] = useState("");
  const [epic, setEpic] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/sprint/${encodeURIComponent(projectId)}/story/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          epic: epic.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const created = (await res.json()) as { id: string; title: string };
      setSuccess(`Created ${created.id}: ${created.title}`);
      setTitle("");
      setEpic("");
      setDescription("");
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create story");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label
          htmlFor="story-title"
          className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1"
        >
          Title *
        </label>
        <input
          id="story-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Story title"
          required
          className="w-full rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] text-[12px] text-[var(--color-text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent placeholder:text-[var(--color-text-muted)]"
        />
      </div>

      <div>
        <label
          htmlFor="story-epic"
          className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1"
        >
          Epic
        </label>
        <input
          id="story-epic"
          type="text"
          value={epic}
          onChange={(e) => setEpic(e.target.value)}
          placeholder="e.g. epic-auth"
          className="w-full rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] text-[12px] text-[var(--color-text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent placeholder:text-[var(--color-text-muted)]"
        />
      </div>

      <div>
        <label
          htmlFor="story-description"
          className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1"
        >
          Description
        </label>
        <textarea
          id="story-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Story description (optional)"
          rows={3}
          className="w-full rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] text-[12px] text-[var(--color-text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent placeholder:text-[var(--color-text-muted)] resize-y"
        />
      </div>

      {error && <div className="text-[12px] text-[var(--color-status-error)]">{error}</div>}

      {success && <div className="text-[12px] text-[var(--color-status-success)]">{success}</div>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-[6px] bg-[var(--color-accent)] text-[var(--color-text-inverse)] px-4 py-2 text-[12px] font-semibold hover:brightness-110 transition-[filter] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        {submitting ? "Creating..." : "Create Story"}
      </button>
    </form>
  );
}
