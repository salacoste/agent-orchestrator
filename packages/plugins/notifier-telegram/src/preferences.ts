/**
 * Telegram notification preference types and filtering logic.
 *
 * Provides severity filtering, quiet hours, and per-event-type overrides
 * for the Telegram notification plugin. This is a SECOND layer of filtering
 * inside the plugin — the first layer (cross-plugin routing) lives in
 * NotificationService.
 * Story 57.3 Tasks 1-3.
 */

import type { Notification } from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SeverityFilter = "critical-only" | "critical-and-warning" | "all";

export interface QuietHoursConfig {
  enabled: boolean;
  /** Start time in HH:MM format, e.g., "22:00" */
  start: string;
  /** End time in HH:MM format, e.g., "07:00" */
  end: string;
  /** IANA timezone, e.g., "America/New_York" */
  timezone: string;
}

export interface TelegramNotificationPreferences {
  /** Severity filter level — controls which priorities pass through */
  severityFilter: SeverityFilter;
  /** Quiet hours — suppress all notifications during this window */
  quietHours: QuietHoursConfig;
  /** Per-event-type enable/disable. true = enabled, false = suppressed */
  eventTypes: Record<string, boolean>;
}

export interface ShouldSendResult {
  /** Whether to send the notification */
  send: boolean;
  /** Whether the notification was suppressed (for digest tracking) */
  suppressed: boolean;
  /** Reason for suppression, if applicable */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default preferences — all enabled, no quiet hours, critical+warning severity. */
export const DEFAULT_PREFERENCES: TelegramNotificationPreferences = {
  severityFilter: "critical-and-warning",
  quietHours: { enabled: false, start: "22:00", end: "07:00", timezone: "UTC" },
  eventTypes: {},
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Validate HH:MM time format with hour 0-23 and minute 0-59. */
function isValidTime(time: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/**
 * Parse and validate raw config into TelegramNotificationPreferences.
 * Falls back to defaults for missing fields. Invalid quiet hours config
 * is treated as disabled (with a console.warn).
 */
export function parsePreferences(
  config?: Record<string, unknown>,
): TelegramNotificationPreferences {
  if (!config)
    return {
      ...DEFAULT_PREFERENCES,
      quietHours: { ...DEFAULT_PREFERENCES.quietHours },
      eventTypes: {},
    };

  const severityFilter = parseSeverityFilter(config.severityFilter);
  const quietHours = parseQuietHours(config.quietHours as Record<string, unknown> | undefined);
  const eventTypes = parseEventTypes(config.eventTypes as Record<string, unknown> | undefined);

  return { severityFilter, quietHours, eventTypes };
}

function parseSeverityFilter(value: unknown): SeverityFilter {
  if (value === "critical-only" || value === "critical-and-warning" || value === "all") {
    return value;
  }
  return DEFAULT_PREFERENCES.severityFilter;
}

function parseQuietHours(config?: Record<string, unknown>): QuietHoursConfig {
  if (!config || typeof config !== "object") {
    return { ...DEFAULT_PREFERENCES.quietHours };
  }

  const enabled = config.enabled === true;
  const start =
    typeof config.start === "string" ? config.start : DEFAULT_PREFERENCES.quietHours.start;
  const end = typeof config.end === "string" ? config.end : DEFAULT_PREFERENCES.quietHours.end;
  const timezone =
    typeof config.timezone === "string" ? config.timezone : DEFAULT_PREFERENCES.quietHours.timezone;

  // Validate time format — disable if invalid
  if (enabled && (!isValidTime(start) || !isValidTime(end))) {
    // eslint-disable-next-line no-console -- notifier plugin: warn about invalid config
    console.warn(
      `[notifier-telegram] Invalid quiet hours time format (start="${start}", end="${end}"). Quiet hours disabled.`,
    );
    return { enabled: false, start, end, timezone };
  }

  // Same start and end means effectively disabled
  if (start === end) {
    return { enabled: false, start, end, timezone };
  }

  return { enabled, start, end, timezone };
}

function parseEventTypes(config?: Record<string, unknown>): Record<string, boolean> {
  if (!config || typeof config !== "object") return {};
  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value === true || value === false) {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Quiet hours logic
// ---------------------------------------------------------------------------

/**
 * Check if the current time falls within the quiet hours window.
 * Uses Intl.DateTimeFormat for timezone-aware comparison.
 * Handles overnight ranges (e.g., 22:00–07:00 crossing midnight).
 */
export function isInQuietHours(config: QuietHoursConfig, now?: Date): boolean {
  if (!config.enabled) return false;
  if (!isValidTime(config.start) || !isValidTime(config.end)) return false;

  const referenceDate = now ?? new Date();

  // Get current HH:MM in the configured timezone
  // Wrap in try/catch — invalid IANA timezone throws RangeError
  let currentTime: string;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: config.timezone || "UTC",
    });
    currentTime = formatter.format(referenceDate);
  } catch {
    // Invalid timezone — treat as not in quiet hours (safe default)
    return false;
  }
  const [currentHour, currentMinute] = currentTime.split(":").map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = config.start.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;

  const [endHour, endMinute] = config.end.split(":").map(Number);
  const endMinutes = endHour * 60 + endMinute;

  // Overnight range (e.g., 22:00–07:00): active if current >= start OR current < end
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  // Normal range (e.g., 09:00–17:00): active if current >= start AND current < end
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

// ---------------------------------------------------------------------------
// Severity filter logic
// ---------------------------------------------------------------------------

/** Check if a priority passes the severity filter. */
function passesSeverityFilter(priority: string, filter: SeverityFilter): boolean {
  switch (filter) {
    case "critical-only":
      return priority === "critical";
    case "critical-and-warning":
      return priority === "critical" || priority === "warning";
    case "all":
      return true;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Main filter
// ---------------------------------------------------------------------------

/**
 * Determine whether a notification should be sent based on preferences.
 *
 * Logic order:
 * 1. Event type override (explicit true → allow, explicit false → suppress)
 * 2. Severity filter
 * 3. Quiet hours
 */
export function shouldSend(
  notification: Notification,
  preferences: TelegramNotificationPreferences,
  now?: Date,
): ShouldSendResult {
  const { eventType, priority } = notification;

  // 1. Event type override — explicit false suppresses, explicit true bypasses severity check
  if (eventType in preferences.eventTypes) {
    if (preferences.eventTypes[eventType] === false) {
      return { send: false, suppressed: true, reason: `event type "${eventType}" disabled` };
    }
    // Explicit true — skip severity check, but still check quiet hours
    if (isInQuietHours(preferences.quietHours, now)) {
      return { send: false, suppressed: true, reason: "quiet hours active" };
    }
    return { send: true, suppressed: false };
  }

  // 2. Severity filter
  if (!passesSeverityFilter(priority, preferences.severityFilter)) {
    return {
      send: false,
      suppressed: true,
      reason: `severity "${priority}" filtered by "${preferences.severityFilter}"`,
    };
  }

  // 3. Quiet hours
  if (isInQuietHours(preferences.quietHours, now)) {
    return { send: false, suppressed: true, reason: "quiet hours active" };
  }

  return { send: true, suppressed: false };
}
