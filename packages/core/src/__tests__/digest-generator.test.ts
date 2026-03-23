/**
 * Digest generator tests (Story 44.7).
 */
import { describe, expect, it } from "vitest";
import { generateDigest, type DigestInput } from "../digest-generator.js";
import { getDefaultConfig, validateConfig } from "../config.js";

function makeInput(overrides: Partial<DigestInput> = {}): DigestInput {
  return {
    completedStories: [],
    activeAgents: [],
    blockers: [],
    totalStories: 10,
    doneStories: 5,
    ...overrides,
  };
}

describe("generateDigest", () => {
  it("generates digest with progress section", () => {
    const digest = generateDigest(makeInput({ totalStories: 20, doneStories: 14 }));

    expect(digest.title).toContain("70%");
    expect(digest.metadata.progressPercent).toBe(70);
    expect(digest.sections[0].title).toBe("Sprint Progress");
    expect(digest.sections[0].items[0]).toContain("14/20");
  });

  it("includes health score when provided", () => {
    const digest = generateDigest(makeInput({ healthScore: 85 }));

    const progressSection = digest.sections[0];
    expect(progressSection.items.some((i) => i.includes("85/100"))).toBe(true);
  });

  it("lists completed stories", () => {
    const digest = generateDigest(
      makeInput({ completedStories: ["43-1-autopilot", "43-2-forecaster"] }),
    );

    expect(digest.metadata.storiesCompleted).toBe(2);
    const section = digest.sections.find((s) => s.title === "Completed Since Last Digest");
    expect(section?.items).toContain("43-1-autopilot");
    expect(section?.items).toContain("43-2-forecaster");
  });

  it("shows empty message when no stories completed", () => {
    const digest = generateDigest(makeInput({ completedStories: [] }));

    const section = digest.sections.find((s) => s.title === "Completed Since Last Digest");
    expect(section?.items[0]).toContain("No stories completed");
  });

  it("lists active agents", () => {
    const digest = generateDigest(makeInput({ activeAgents: ["agent-1", "agent-2"] }));

    expect(digest.metadata.activeAgents).toBe(2);
    const section = digest.sections.find((s) => s.title === "Active Agents");
    expect(section?.items).toContain("agent-1");
  });

  it("shows empty message when no active agents", () => {
    const digest = generateDigest(makeInput({ activeAgents: [] }));

    const section = digest.sections.find((s) => s.title === "Active Agents");
    expect(section?.items[0]).toContain("No agents currently active");
  });

  it("includes blockers section when present", () => {
    const digest = generateDigest(
      makeInput({ blockers: ["44-3-blocked-on-api"], stuckStories: ["Story 44-5 stuck > 2h"] }),
    );

    expect(digest.metadata.blockerCount).toBe(1);
    const section = digest.sections.find((s) => s.title === "Blockers & Alerts");
    expect(section).toBeDefined();
    expect(section?.items).toContain("44-3-blocked-on-api");
    expect(section?.items).toContain("Story 44-5 stuck > 2h");
  });

  it("omits blockers section when none", () => {
    const digest = generateDigest(makeInput({ blockers: [], stuckStories: [] }));

    const section = digest.sections.find((s) => s.title === "Blockers & Alerts");
    expect(section).toBeUndefined();
  });

  it("handles zero total stories gracefully", () => {
    const digest = generateDigest(makeInput({ totalStories: 0, doneStories: 0 }));

    expect(digest.metadata.progressPercent).toBe(0);
    expect(digest.title).toContain("0%");
  });

  it("generates valid markdown output", () => {
    const digest = generateDigest(
      makeInput({
        completedStories: ["story-1"],
        activeAgents: ["agent-A"],
        since: "2026-03-22T09:00:00Z",
      }),
    );

    expect(digest.markdown).toContain("# Sprint Digest");
    expect(digest.markdown).toContain("## Sprint Progress");
    expect(digest.markdown).toContain("- story-1");
    expect(digest.markdown).toContain("Period:");
  });

  it("includes since timestamp in metadata", () => {
    const digest = generateDigest(makeInput({ since: "2026-03-22T09:00:00Z" }));

    expect(digest.metadata.since).toBe("2026-03-22T09:00:00Z");
    expect(digest.metadata.generatedAt).toBeTruthy();
  });

  it("returns null since when not provided", () => {
    const digest = generateDigest(makeInput());

    expect(digest.metadata.since).toBeNull();
  });
});

describe("notificationDigest config schema", () => {
  it("defaults to disabled in getDefaultConfig", () => {
    const config = getDefaultConfig();
    expect(config.notificationDigest.enabled).toBe(false);
    expect(config.notificationDigest.schedule).toBe("09:00");
    expect(config.notificationDigest.timezone).toBe("UTC");
  });

  it("accepts valid digest config via validateConfig", () => {
    const config = validateConfig({
      projects: {},
      notificationDigest: { enabled: true, schedule: "14:30", timezone: "America/New_York" },
    });
    expect(config.notificationDigest.enabled).toBe(true);
    expect(config.notificationDigest.schedule).toBe("14:30");
    expect(config.notificationDigest.timezone).toBe("America/New_York");
  });

  it("rejects invalid schedule format", () => {
    expect(() =>
      validateConfig({
        projects: {},
        notificationDigest: { schedule: "9am" },
      }),
    ).toThrow();
  });
});
