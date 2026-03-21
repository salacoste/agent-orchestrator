/**
 * Accessibility utilities (Stories 29.1-29.4).
 *
 * Screen reader helpers, high contrast mode, reduced motion detection.
 * Pure module — provides utilities for components to use.
 */

// ---------------------------------------------------------------------------
// Story 29.1: Screen Reader-First Agent Status
// ---------------------------------------------------------------------------

/** Generate accessible status description for screen readers. */
export function getAgentStatusDescription(
  agentId: string,
  storyId: string | null,
  status: string,
  durationMinutes: number,
): string {
  const parts = [`Agent ${agentId}`];
  if (storyId) parts.push(`working on story ${storyId}`);
  parts.push(`status ${status}`);
  if (durationMinutes > 0) parts.push(`for ${durationMinutes} minutes`);
  return parts.join(", ");
}

/** Generate live region announcement for status changes. */
export function getStatusChangeAnnouncement(
  agentId: string,
  previousStatus: string,
  newStatus: string,
): string {
  return `Agent ${agentId} changed from ${previousStatus} to ${newStatus}`;
}

// ---------------------------------------------------------------------------
// Story 29.2: High Contrast Mode
// ---------------------------------------------------------------------------

/** Status shapes for color-blind accessibility. */
export const STATUS_SHAPES: Record<string, { shape: string; label: string }> = {
  working: { shape: "●", label: "circle (working)" },
  blocked: { shape: "■", label: "square (blocked)" },
  completed: { shape: "▲", label: "triangle (completed)" },
  idle: { shape: "◇", label: "diamond (idle)" },
  error: { shape: "✕", label: "cross (error)" },
};

/** Get shape + label for a status (high contrast mode). */
export function getStatusShape(status: string): { shape: string; label: string } {
  return STATUS_SHAPES[status] ?? { shape: "○", label: `circle (${status})` };
}

// ---------------------------------------------------------------------------
// Story 29.3: Reduced Motion
// ---------------------------------------------------------------------------

/** Check if user prefers reduced motion (client-side only). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Get animation class based on motion preference. */
export function getAnimationClass(normalClass: string, reducedClass: string = ""): string {
  return prefersReducedMotion() ? reducedClass : normalClass;
}

// ---------------------------------------------------------------------------
// Story 29.4: WCAG Audit Helpers
// ---------------------------------------------------------------------------

/** Minimum contrast ratio for WCAG AA compliance. */
export const WCAG_AA_CONTRAST_RATIO = 4.5;

/** Check if a component has required ARIA attributes. */
export function validateAriaAttributes(element: {
  role?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (element.role === "button" && !element.ariaLabel && !element.ariaLabelledBy) {
    issues.push("Interactive element missing aria-label or aria-labelledby");
  }

  return { valid: issues.length === 0, issues };
}
