/**
 * Notification priority tiers (Story 22.5).
 *
 * Classifies notifications into 3 tiers with different visual treatment.
 * Pure module — rule-based classification, no side effects.
 */

/** Notification tier. */
export type NotificationTier = 1 | 2 | 3;

/** A classified notification. */
export interface TieredNotification {
  /** Unique notification ID. */
  id: string;
  /** Notification tier: 1=critical, 2=action needed, 3=informational. */
  tier: NotificationTier;
  /** Notification title. */
  title: string;
  /** Notification message. */
  message: string;
  /** Event type that triggered this notification. */
  eventType: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

/** Tier classification rules. */
const TIER_RULES: Array<{ pattern: RegExp; tier: NotificationTier }> = [
  // Tier 1 (Red): Critical — needs immediate attention
  { pattern: /agent\.blocked|conflict\.detected|decision\.required/, tier: 1 },
  // Tier 2 (Amber): Action needed — but not urgent
  { pattern: /pr\.ready|scope\.creep|review\.needed/, tier: 2 },
  // Tier 3 (Green): Informational — milestone updates
  { pattern: /story\.completed|sprint\.milestone|agent\.completed/, tier: 3 },
];

/**
 * Classify a notification event into a tier.
 * Default: tier 3 (informational) for unrecognized events.
 */
export function classifyNotificationTier(eventType: string): NotificationTier {
  for (const rule of TIER_RULES) {
    if (rule.pattern.test(eventType)) {
      return rule.tier;
    }
  }
  return 3; // Default: informational
}

/**
 * Get the visual style for a notification tier.
 */
export function getTierStyle(tier: NotificationTier): {
  color: string;
  icon: string;
  display: "alert" | "badge" | "toast";
} {
  switch (tier) {
    case 1:
      return { color: "red", icon: "🔴", display: "alert" };
    case 2:
      return { color: "amber", icon: "🟡", display: "badge" };
    case 3:
      return { color: "green", icon: "🟢", display: "toast" };
  }
}
