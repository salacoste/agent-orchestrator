/**
 * Tests for Telegram notification preference filtering.
 * Story 57.3 Task 6 — verify severity filter, quiet hours, event type overrides.
 */
import { describe, it, expect, vi } from "vitest";
import {
  parsePreferences,
  shouldSend,
  isInQuietHours,
  DEFAULT_PREFERENCES,
  type TelegramNotificationPreferences,
} from "../preferences.js";
import type { Notification } from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(overrides?: Partial<Notification>): Notification {
  return {
    eventId: "test-1",
    eventType: "agent.blocked",
    priority: "critical",
    title: "Test",
    message: "Something happened",
    metadata: {},
    timestamp: "2026-04-08T00:00:00.000Z",
    ...overrides,
  };
}

function makeTime(hour: number, minute: number, tz = "UTC"): Date {
  // Create a date that, when formatted in the given timezone, shows hour:minute
  const d = new Date("2026-04-08T12:00:00.000Z");
  // For UTC, just set directly
  if (tz === "UTC") {
    d.setUTCHours(hour, minute, 0, 0);
  }
  return d;
}

// ---------------------------------------------------------------------------
// parsePreferences
// ---------------------------------------------------------------------------

describe("parsePreferences", () => {
  it("returns defaults when config is undefined", () => {
    const prefs = parsePreferences(undefined);
    expect(prefs.severityFilter).toBe("critical-and-warning");
    expect(prefs.quietHours.enabled).toBe(false);
    expect(prefs.eventTypes).toEqual({});
  });

  it("returns defaults when config is empty", () => {
    const prefs = parsePreferences({});
    expect(prefs.severityFilter).toBe("critical-and-warning");
    expect(prefs.quietHours.enabled).toBe(false);
  });

  it("parses valid severityFilter", () => {
    expect(parsePreferences({ severityFilter: "critical-only" }).severityFilter).toBe(
      "critical-only",
    );
    expect(parsePreferences({ severityFilter: "all" }).severityFilter).toBe("all");
  });

  it("ignores invalid severityFilter", () => {
    expect(parsePreferences({ severityFilter: "invalid" }).severityFilter).toBe(
      "critical-and-warning",
    );
  });

  it("parses valid quiet hours config", () => {
    const prefs = parsePreferences({
      quietHours: { enabled: true, start: "23:00", end: "06:00", timezone: "US/Eastern" },
    });
    expect(prefs.quietHours.enabled).toBe(true);
    expect(prefs.quietHours.start).toBe("23:00");
    expect(prefs.quietHours.end).toBe("06:00");
    expect(prefs.quietHours.timezone).toBe("US/Eastern");
  });

  it("disables quiet hours when time format is invalid", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const prefs = parsePreferences({
      quietHours: { enabled: true, start: "invalid", end: "07:00", timezone: "UTC" },
    });
    expect(prefs.quietHours.enabled).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("disables quiet hours when start equals end", () => {
    const prefs = parsePreferences({
      quietHours: { enabled: true, start: "12:00", end: "12:00", timezone: "UTC" },
    });
    expect(prefs.quietHours.enabled).toBe(false);
  });

  it("disables quiet hours when time values are out of range", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const prefs = parsePreferences({
      quietHours: { enabled: true, start: "99:99", end: "07:00", timezone: "UTC" },
    });
    expect(prefs.quietHours.enabled).toBe(false);
    warnSpy.mockRestore();
  });

  it("parses event type overrides", () => {
    const prefs = parsePreferences({
      eventTypes: { "agent.blocked": true, "agent.offline": false, "story.blocked": true },
    });
    expect(prefs.eventTypes).toEqual({
      "agent.blocked": true,
      "agent.offline": false,
      "story.blocked": true,
    });
  });

  it("ignores non-boolean event type values", () => {
    const prefs = parsePreferences({
      eventTypes: { "agent.blocked": true, "agent.offline": "yes", "story.blocked": 1 },
    });
    expect(prefs.eventTypes).toEqual({ "agent.blocked": true });
  });
});

// ---------------------------------------------------------------------------
// isInQuietHours
// ---------------------------------------------------------------------------

describe("isInQuietHours", () => {
  it("returns false when disabled", () => {
    expect(isInQuietHours({ enabled: false, start: "22:00", end: "07:00", timezone: "UTC" })).toBe(
      false,
    );
  });

  it("returns false when time format is invalid", () => {
    expect(isInQuietHours({ enabled: true, start: "bad", end: "07:00", timezone: "UTC" })).toBe(
      false,
    );
  });

  it("returns false for out-of-range times like 99:99", () => {
    expect(isInQuietHours({ enabled: true, start: "99:99", end: "07:00", timezone: "UTC" })).toBe(
      false,
    );
  });

  it("returns false for out-of-range hours like 25:00", () => {
    expect(isInQuietHours({ enabled: true, start: "25:00", end: "07:00", timezone: "UTC" })).toBe(
      false,
    );
  });

  it("returns false for invalid IANA timezone", () => {
    const now = makeTime(23, 0);
    expect(
      isInQuietHours(
        { enabled: true, start: "22:00", end: "07:00", timezone: "Invalid/Timezone" },
        now,
      ),
    ).toBe(false);
  });

  it("detects time within normal range (daytime)", () => {
    // 14:00 is within 09:00-17:00
    const now = makeTime(14, 0);
    expect(
      isInQuietHours({ enabled: true, start: "09:00", end: "17:00", timezone: "UTC" }, now),
    ).toBe(true);
  });

  it("detects time outside normal range", () => {
    // 08:00 is outside 09:00-17:00
    const now = makeTime(8, 0);
    expect(
      isInQuietHours({ enabled: true, start: "09:00", end: "17:00", timezone: "UTC" }, now),
    ).toBe(false);
  });

  it("handles overnight range crossing midnight", () => {
    // 23:00 is within 22:00-07:00
    const now = makeTime(23, 0);
    expect(
      isInQuietHours({ enabled: true, start: "22:00", end: "07:00", timezone: "UTC" }, now),
    ).toBe(true);
  });

  it("handles overnight range — early morning", () => {
    // 03:00 is within 22:00-07:00
    const now = makeTime(3, 0);
    expect(
      isInQuietHours({ enabled: true, start: "22:00", end: "07:00", timezone: "UTC" }, now),
    ).toBe(true);
  });

  it("handles overnight range — outside at boundary end", () => {
    // 07:00 is NOT within 22:00-07:00 (end is exclusive)
    const now = makeTime(7, 0);
    expect(
      isInQuietHours({ enabled: true, start: "22:00", end: "07:00", timezone: "UTC" }, now),
    ).toBe(false);
  });

  it("handles overnight range — outside during daytime", () => {
    // 12:00 is outside 22:00-07:00
    const now = makeTime(12, 0);
    expect(
      isInQuietHours({ enabled: true, start: "22:00", end: "07:00", timezone: "UTC" }, now),
    ).toBe(false);
  });

  it("handles overnight range — at start boundary", () => {
    // 22:00 is within 22:00-07:00 (start is inclusive)
    const now = makeTime(22, 0);
    expect(
      isInQuietHours({ enabled: true, start: "22:00", end: "07:00", timezone: "UTC" }, now),
    ).toBe(true);
  });

  it("uses UTC when timezone is empty", () => {
    const now = makeTime(23, 30);
    expect(isInQuietHours({ enabled: true, start: "22:00", end: "07:00", timezone: "" }, now)).toBe(
      true,
    );
  });

  it("handles timezone America/New_York", () => {
    // Test with a specific date/time in EST — just verify no crash
    const now = new Date("2026-04-08T23:00:00-04:00"); // 11PM EDT
    expect(
      isInQuietHours(
        { enabled: true, start: "22:00", end: "07:00", timezone: "America/New_York" },
        now,
      ),
    ).toBe(true);
  });

  it("handles timezone America/Los_Angeles", () => {
    const now = new Date("2026-04-08T23:00:00-07:00"); // 11PM PDT
    expect(
      isInQuietHours(
        { enabled: true, start: "22:00", end: "07:00", timezone: "America/Los_Angeles" },
        now,
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldSend — Severity filter
// ---------------------------------------------------------------------------

describe("shouldSend — severity filter", () => {
  it("critical-only allows critical", () => {
    const prefs: TelegramNotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      severityFilter: "critical-only",
    };
    const result = shouldSend(makeNotification({ priority: "critical" }), prefs);
    expect(result.send).toBe(true);
    expect(result.suppressed).toBe(false);
  });

  it("critical-only suppresses warning", () => {
    const prefs: TelegramNotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      severityFilter: "critical-only",
    };
    const result = shouldSend(makeNotification({ priority: "warning" }), prefs);
    expect(result.send).toBe(false);
    expect(result.suppressed).toBe(true);
    expect(result.reason).toContain("severity");
  });

  it("critical-only suppresses info", () => {
    const prefs: TelegramNotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      severityFilter: "critical-only",
    };
    const result = shouldSend(makeNotification({ priority: "info" }), prefs);
    expect(result.send).toBe(false);
  });

  it("critical-and-warning allows critical and warning", () => {
    const prefs: TelegramNotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      severityFilter: "critical-and-warning",
    };
    expect(shouldSend(makeNotification({ priority: "critical" }), prefs).send).toBe(true);
    expect(shouldSend(makeNotification({ priority: "warning" }), prefs).send).toBe(true);
  });

  it("critical-and-warning suppresses info", () => {
    const prefs: TelegramNotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      severityFilter: "critical-and-warning",
    };
    expect(shouldSend(makeNotification({ priority: "info" }), prefs).send).toBe(false);
  });

  it("all allows everything", () => {
    const prefs: TelegramNotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      severityFilter: "all",
    };
    expect(shouldSend(makeNotification({ priority: "critical" }), prefs).send).toBe(true);
    expect(shouldSend(makeNotification({ priority: "warning" }), prefs).send).toBe(true);
    expect(shouldSend(makeNotification({ priority: "info" }), prefs).send).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldSend — Event type overrides
// ---------------------------------------------------------------------------

describe("shouldSend — event type overrides", () => {
  it("explicitly disabled event type is suppressed", () => {
    const prefs: TelegramNotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      eventTypes: { "agent.offline": false },
    };
    const result = shouldSend(
      makeNotification({ eventType: "agent.offline", priority: "warning" }),
      prefs,
    );
    expect(result.send).toBe(false);
    expect(result.suppressed).toBe(true);
    expect(result.reason).toContain("disabled");
  });

  it("explicitly enabled event type bypasses severity filter", () => {
    const prefs: TelegramNotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      severityFilter: "critical-only",
      eventTypes: { "agent.offline": true },
    };
    // agent.offline is warning priority, but explicitly enabled
    const result = shouldSend(
      makeNotification({ eventType: "agent.offline", priority: "warning" }),
      prefs,
    );
    expect(result.send).toBe(true);
  });

  it("unconfigured event type falls through to severity filter", () => {
    const prefs: TelegramNotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      severityFilter: "critical-only",
      eventTypes: { "agent.blocked": true },
    };
    // agent.offline not in eventTypes, warning priority, critical-only filter
    const result = shouldSend(
      makeNotification({ eventType: "agent.offline", priority: "warning" }),
      prefs,
    );
    expect(result.send).toBe(false);
  });

  it("other event types are unaffected when one is disabled", () => {
    const prefs: TelegramNotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      eventTypes: { "agent.offline": false },
    };
    const result = shouldSend(
      makeNotification({ eventType: "agent.blocked", priority: "critical" }),
      prefs,
    );
    expect(result.send).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldSend — Quiet hours
// ---------------------------------------------------------------------------

describe("shouldSend — quiet hours", () => {
  it("suppresses during quiet hours", () => {
    const prefs: TelegramNotificationPreferences = {
      severityFilter: "all",
      quietHours: { enabled: true, start: "22:00", end: "07:00", timezone: "UTC" },
      eventTypes: {},
    };
    // 23:00 UTC — within quiet hours
    const now = makeTime(23, 0);
    const result = shouldSend(makeNotification({ priority: "critical" }), prefs, now);
    expect(result.send).toBe(false);
    expect(result.suppressed).toBe(true);
    expect(result.reason).toContain("quiet hours");
  });

  it("allows outside quiet hours", () => {
    const prefs: TelegramNotificationPreferences = {
      severityFilter: "all",
      quietHours: { enabled: true, start: "22:00", end: "07:00", timezone: "UTC" },
      eventTypes: {},
    };
    // 12:00 UTC — outside quiet hours
    const now = makeTime(12, 0);
    const result = shouldSend(makeNotification({ priority: "critical" }), prefs, now);
    expect(result.send).toBe(true);
  });

  it("explicitly enabled event type still suppressed during quiet hours", () => {
    const prefs: TelegramNotificationPreferences = {
      severityFilter: "all",
      quietHours: { enabled: true, start: "22:00", end: "07:00", timezone: "UTC" },
      eventTypes: { "agent.blocked": true },
    };
    const now = makeTime(23, 0);
    const result = shouldSend(
      makeNotification({ eventType: "agent.blocked", priority: "critical" }),
      prefs,
      now,
    );
    expect(result.send).toBe(false);
    expect(result.reason).toContain("quiet hours");
  });
});

// ---------------------------------------------------------------------------
// shouldSend — Default preferences (no config)
// ---------------------------------------------------------------------------

describe("shouldSend — default preferences (backward compat)", () => {
  it("allows critical events with defaults", () => {
    const result = shouldSend(makeNotification({ priority: "critical" }), DEFAULT_PREFERENCES);
    expect(result.send).toBe(true);
  });

  it("allows warning events with defaults", () => {
    const result = shouldSend(makeNotification({ priority: "warning" }), DEFAULT_PREFERENCES);
    expect(result.send).toBe(true);
  });

  it("suppresses info events with defaults (critical-and-warning filter)", () => {
    const result = shouldSend(makeNotification({ priority: "info" }), DEFAULT_PREFERENCES);
    expect(result.send).toBe(false);
  });

  it("allows all event types with defaults (no overrides)", () => {
    const result = shouldSend(
      makeNotification({ eventType: "agent.blocked", priority: "critical" }),
      DEFAULT_PREFERENCES,
    );
    expect(result.send).toBe(true);
  });
});
