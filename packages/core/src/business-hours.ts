/**
 * Business Hours — Time-sensitive spawning gate (Story 43.7).
 *
 * Pure function that checks if the current time falls within
 * configured business hours. Used by autopilot to defer spawns
 * outside working hours.
 */

/** Business hours configuration. */
export interface BusinessHoursConfig {
  /** Start time in "HH:MM" 24-hour format (e.g., "09:00"). */
  start: string;
  /** End time in "HH:MM" 24-hour format (e.g., "18:00"). */
  end: string;
  /** IANA timezone or UTC offset (e.g., "UTC", "America/New_York"). Defaults to UTC. */
  timezone?: string;
}

/**
 * Check if the given time is within business hours.
 *
 * @param config — business hours configuration. If undefined, returns true (24/7 mode).
 * @param now — current time (default: new Date()). Pass explicitly for testability.
 * @returns true if within business hours or no config (24/7)
 */
export function isWithinBusinessHours(
  config: BusinessHoursConfig | undefined,
  now: Date = new Date(),
): boolean {
  if (!config) return true; // No config = 24/7

  const startMinutes = parseTimeToMinutes(config.start);
  const endMinutes = parseTimeToMinutes(config.end);

  if (startMinutes === null || endMinutes === null) {
    return true; // Invalid config = fail open (don't block spawns)
  }

  // Get current time in the configured timezone
  const currentMinutes = getCurrentMinutesInTimezone(now, config.timezone);

  // Handle normal hours (e.g., 09:00-18:00) and overnight (e.g., 22:00-06:00)
  if (startMinutes <= endMinutes) {
    // Normal: within hours if start <= current < end
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight: within hours if current >= start OR current < end
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Parse "HH:MM" string to minutes since midnight.
 * Returns null for invalid format.
 */
function parseTimeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/**
 * Get current minutes since midnight in the specified timezone.
 */
function getCurrentMinutesInTimezone(now: Date, timezone?: string): number {
  try {
    // Use Intl.DateTimeFormat to get time in the target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone ?? "UTC",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    return hour * 60 + minute;
  } catch {
    // Invalid timezone — fall back to UTC
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}
