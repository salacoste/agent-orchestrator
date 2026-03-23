/**
 * Standup generator tests (Story 45.5).
 */
import { describe, expect, it } from "vitest";
import { generateStandup, type StandupInput } from "../standup-generator.js";

function makeInput(overrides: Partial<StandupInput> = {}): StandupInput {
  return {
    completedStories: [],
    inProgressStories: [],
    blockers: [],
    activeAgents: [],
    timeWindowHours: 24,
    ...overrides,
  };
}

describe("generateStandup", () => {
  it("returns no-activity summary when nothing happened", () => {
    const summary = generateStandup(makeInput());

    expect(summary.hasActivity).toBe(false);
    expect(summary.sections).toHaveLength(0);
    expect(summary.markdown).toContain("No activity to report");
  });

  it("generates summary with completed stories", () => {
    const summary = generateStandup(
      makeInput({ completedStories: ["45-3-post-mortem", "45-4-roi"] }),
    );

    expect(summary.hasActivity).toBe(true);
    const completed = summary.sections.find((s) => s.title === "Completed");
    expect(completed?.items).toContain("45-3-post-mortem");
    expect(completed?.items).toContain("45-4-roi");
  });

  it("generates summary with in-progress stories", () => {
    const summary = generateStandup(makeInput({ inProgressStories: ["45-5-standup"] }));

    const inProgress = summary.sections.find((s) => s.title === "In Progress");
    expect(inProgress?.items).toContain("45-5-standup");
  });

  it("generates summary with blockers", () => {
    const summary = generateStandup(makeInput({ blockers: ["45-6-blocked-on-api"] }));

    const blockers = summary.sections.find((s) => s.title === "Blockers");
    expect(blockers?.items).toContain("45-6-blocked-on-api");
  });

  it("shows 'None' for empty sections when activity exists", () => {
    const summary = generateStandup(makeInput({ activeAgents: ["agent-1"] }));

    const completed = summary.sections.find((s) => s.title === "Completed");
    expect(completed?.items).toEqual(["None"]);
  });

  it("formats markdown with bold headings and bullets", () => {
    const summary = generateStandup(
      makeInput({
        completedStories: ["story-1"],
        inProgressStories: ["story-2"],
        blockers: [],
        activeAgents: ["agent-A"],
      }),
    );

    expect(summary.markdown).toContain("**Daily Standup");
    expect(summary.markdown).toContain("**Completed:**");
    expect(summary.markdown).toContain("- story-1");
    expect(summary.markdown).toContain("**In Progress:**");
    expect(summary.markdown).toContain("- story-2");
    expect(summary.markdown).toContain("**Active Agents:** 1");
  });

  it("includes date in title", () => {
    const summary = generateStandup(makeInput({ activeAgents: ["a"] }));
    const today = new Date().toISOString().slice(0, 10);

    expect(summary.title).toContain(today);
  });

  it("includes generatedAt timestamp", () => {
    const summary = generateStandup(makeInput({ activeAgents: ["a"] }));

    expect(summary.generatedAt).toBeTruthy();
    expect(new Date(summary.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("detects activity from agents alone", () => {
    const summary = generateStandup(makeInput({ activeAgents: ["agent-1", "agent-2"] }));

    expect(summary.hasActivity).toBe(true);
    expect(summary.markdown).toContain("**Active Agents:** 2");
  });
});
