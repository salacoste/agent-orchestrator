import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConflictHistoryList } from "../ConflictHistoryList";
import type { ConflictHistoryEntry } from "@composio/ao-core";

function makeEntry(overrides: Partial<ConflictHistoryEntry> = {}): ConflictHistoryEntry {
  return {
    id: "history-test-001",
    conflict: {
      id: "conflict-001",
      resourceType: "repository",
      resourceIdentifier: "org/shared-repo",
      competingProjects: ["proj-a", "proj-b"],
      severity: "high",
      detectedAt: "2026-04-01T12:00:00.000Z",
      metadata: {},
    },
    resolvedAt: "2026-04-01T14:00:00.000Z",
    resolutionStrategy: "sequential-scheduling",
    resolutionOutcome: "resolved",
    resolvedBy: "user@example.com",
    notes: "",
    ...overrides,
  };
}

describe("ConflictHistoryList", () => {
  it("renders empty state when no entries", () => {
    render(<ConflictHistoryList entries={[]} />);
    expect(screen.getByText("No conflict history entries found.")).toBeDefined();
  });

  it("renders history entries", () => {
    const entries = [
      makeEntry({ id: "h1", conflict: { ...makeEntry().conflict, resourceIdentifier: "repo-a" } }),
      makeEntry({ id: "h2", conflict: { ...makeEntry().conflict, resourceIdentifier: "repo-b" } }),
    ];
    render(<ConflictHistoryList entries={entries} />);
    expect(screen.getByText("repo-a")).toBeDefined();
    expect(screen.getByText("repo-b")).toBeDefined();
  });

  it("shows outcome badge", () => {
    const entry = makeEntry({ resolutionOutcome: "auto-resolved" });
    render(<ConflictHistoryList entries={[entry]} />);
    expect(screen.getByText("Auto Resolved")).toBeDefined();
  });

  it("shows notes when present", () => {
    const entry = makeEntry({ notes: "Queued project B" });
    render(<ConflictHistoryList entries={[entry]} />);
    expect(screen.getByText(/Queued project B/)).toBeDefined();
  });

  it("displays strategy and resolved by", () => {
    const entry = makeEntry({
      resolutionStrategy: "agent-reassignment",
      resolvedBy: "admin@org.com",
    });
    render(<ConflictHistoryList entries={[entry]} />);
    expect(screen.getByText("Agent Reassignment")).toBeDefined();
    expect(screen.getByText("admin@org.com")).toBeDefined();
  });

  it("shows competing projects", () => {
    const entry = makeEntry();
    render(<ConflictHistoryList entries={[entry]} />);
    expect(screen.getByText(/proj-a/)).toBeDefined();
    expect(screen.getByText(/proj-b/)).toBeDefined();
  });
});
