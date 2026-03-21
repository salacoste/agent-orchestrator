/**
 * Keyboard shortcut definitions (Story 22.3).
 *
 * Defines the shortcut map for dashboard navigation.
 * Pure data module — the hook implementation wires these to DOM events.
 */

/** A keyboard shortcut definition. */
export interface KeyboardShortcut {
  /** Key combination (e.g., "g+f", "?", "n"). */
  keys: string;
  /** Human-readable description. */
  description: string;
  /** Dashboard section/action this shortcut triggers. */
  action: string;
  /** Category for grouping in help modal. */
  category: "navigation" | "action" | "help";
}

/** All dashboard keyboard shortcuts. */
export const KEYBOARD_SHORTCUTS: readonly KeyboardShortcut[] = [
  {
    keys: "g+f",
    description: "Go to Fleet view",
    action: "navigate:fleet",
    category: "navigation",
  },
  {
    keys: "g+s",
    description: "Go to Sprint view",
    action: "navigate:sprint",
    category: "navigation",
  },
  {
    keys: "g+w",
    description: "Go to Workflow view",
    action: "navigate:workflow",
    category: "navigation",
  },
  { keys: "n", description: "Next notification", action: "notification:next", category: "action" },
  { keys: "space", description: "Approve / advance", action: "approve", category: "action" },
  { keys: "?", description: "Show keyboard shortcuts", action: "help:shortcuts", category: "help" },
];

/**
 * Get shortcuts grouped by category for the help modal.
 */
export function getShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
  const grouped: Record<string, KeyboardShortcut[]> = {};
  for (const shortcut of KEYBOARD_SHORTCUTS) {
    const cat = shortcut.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(shortcut);
  }
  return grouped;
}
