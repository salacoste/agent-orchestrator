import { describe, expect, it, vi } from "vitest";

import {
  getAgentStatusDescription,
  getAnimationClass,
  getStatusChangeAnnouncement,
  getStatusShape,
  STATUS_SHAPES,
  validateAriaAttributes,
  WCAG_AA_CONTRAST_RATIO,
} from "../accessibility";

describe("Screen Reader (Story 29.1)", () => {
  it("generates full status description", () => {
    const desc = getAgentStatusDescription("agent-3", "story-1-5", "blocked", 45);
    expect(desc).toContain("Agent agent-3");
    expect(desc).toContain("story-1-5");
    expect(desc).toContain("blocked");
    expect(desc).toContain("45 minutes");
  });

  it("omits story when null", () => {
    const desc = getAgentStatusDescription("agent-1", null, "idle", 0);
    expect(desc).not.toContain("story");
  });

  it("generates status change announcement", () => {
    const msg = getStatusChangeAnnouncement("agent-2", "working", "blocked");
    expect(msg).toBe("Agent agent-2 changed from working to blocked");
  });
});

describe("High Contrast (Story 29.2)", () => {
  it("defines shapes for all common statuses", () => {
    expect(STATUS_SHAPES["working"]).toBeDefined();
    expect(STATUS_SHAPES["blocked"]).toBeDefined();
    expect(STATUS_SHAPES["completed"]).toBeDefined();
    expect(STATUS_SHAPES["idle"]).toBeDefined();
  });

  it("returns fallback shape for unknown status", () => {
    const shape = getStatusShape("unknown-status");
    expect(shape.shape).toBe("○");
  });

  it("each shape has a label for screen readers", () => {
    for (const [, v] of Object.entries(STATUS_SHAPES)) {
      expect(v.label).toBeTruthy();
    }
  });
});

describe("Reduced Motion (Story 29.3)", () => {
  it("getAnimationClass returns normal class when no motion preference", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    expect(getAnimationClass("animate-pulse", "")).toBe("animate-pulse");
  });

  it("getAnimationClass returns reduced class when preference set", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    expect(getAnimationClass("animate-pulse", "no-animation")).toBe("no-animation");
  });
});

describe("WCAG Audit (Story 29.4)", () => {
  it("WCAG_AA_CONTRAST_RATIO is 4.5", () => {
    expect(WCAG_AA_CONTRAST_RATIO).toBe(4.5);
  });

  it("validates button needs aria-label", () => {
    const result = validateAriaAttributes({ role: "button" });
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
  });

  it("passes when aria-label provided", () => {
    const result = validateAriaAttributes({ role: "button", ariaLabel: "Close" });
    expect(result.valid).toBe(true);
  });

  it("passes for non-button roles", () => {
    const result = validateAriaAttributes({ role: "region" });
    expect(result.valid).toBe(true);
  });
});
