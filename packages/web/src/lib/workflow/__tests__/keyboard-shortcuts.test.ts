import { describe, expect, it } from "vitest";

import { getShortcutsByCategory, KEYBOARD_SHORTCUTS } from "../keyboard-shortcuts";

describe("KEYBOARD_SHORTCUTS", () => {
  it("defines at least 5 shortcuts", () => {
    expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThanOrEqual(5);
  });

  it("every shortcut has required fields", () => {
    for (const s of KEYBOARD_SHORTCUTS) {
      expect(s.keys).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.action).toBeTruthy();
      expect(["navigation", "action", "help"]).toContain(s.category);
    }
  });

  it("includes ? for help", () => {
    expect(KEYBOARD_SHORTCUTS.some((s) => s.keys === "?")).toBe(true);
  });
});

describe("getShortcutsByCategory", () => {
  it("groups shortcuts into categories", () => {
    const grouped = getShortcutsByCategory();
    expect(grouped["navigation"]).toBeDefined();
    expect(grouped["navigation"].length).toBeGreaterThan(0);
    expect(grouped["help"]).toBeDefined();
  });
});
