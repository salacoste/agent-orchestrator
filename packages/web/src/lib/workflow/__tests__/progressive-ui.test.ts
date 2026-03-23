/**
 * Progressive UI tests (Story 44.5).
 */
import { describe, expect, it } from "vitest";
import { filterWidgetsByLevel, WIDGET_META, type WidgetId } from "../widget-registry";

/** Derived from registry so test stays in sync when widgets are added. */
const ALL_WIDGETS = Object.keys(WIDGET_META) as WidgetId[];

describe("filterWidgetsByLevel", () => {
  it("beginner sees only beginner widgets", () => {
    const filtered = filterWidgetsByLevel(ALL_WIDGETS, "beginner");

    // Beginner widgets: phaseBar, cascadeAlert, recommendation, agents
    expect(filtered).toContain("phaseBar");
    expect(filtered).toContain("cascadeAlert");
    expect(filtered).toContain("recommendation");
    expect(filtered).toContain("agents");

    // Should NOT include intermediate/advanced
    expect(filtered).not.toContain("artifacts");
    expect(filtered).not.toContain("costPanel");
    expect(filtered).not.toContain("conflictPanel");
    expect(filtered).not.toContain("chatPanel");
  });

  it("intermediate sees beginner + intermediate widgets", () => {
    const filtered = filterWidgetsByLevel(ALL_WIDGETS, "intermediate");

    expect(filtered).toContain("phaseBar"); // beginner
    expect(filtered).toContain("artifacts"); // intermediate
    expect(filtered).toContain("costPanel"); // intermediate
    expect(filtered).toContain("antiPatterns"); // intermediate

    // Should NOT include advanced
    expect(filtered).not.toContain("conflictPanel");
    expect(filtered).not.toContain("chatPanel");
  });

  it("advanced sees beginner + intermediate + advanced widgets", () => {
    const filtered = filterWidgetsByLevel(ALL_WIDGETS, "advanced");

    expect(filtered).toContain("phaseBar"); // beginner
    expect(filtered).toContain("costPanel"); // intermediate
    expect(filtered).toContain("conflictPanel"); // advanced
    expect(filtered).toContain("chatPanel"); // advanced
  });

  it("expert sees all widgets", () => {
    const filtered = filterWidgetsByLevel(ALL_WIDGETS, "expert");

    expect(filtered).toEqual(ALL_WIDGETS);
  });

  it("preserves order from input layout", () => {
    const layout: WidgetId[] = ["chatPanel", "phaseBar", "agents"];
    const filtered = filterWidgetsByLevel(layout, "expert");

    expect(filtered).toEqual(["chatPanel", "phaseBar", "agents"]);
  });

  it("returns empty for empty layout", () => {
    expect(filterWidgetsByLevel([], "expert")).toEqual([]);
  });

  it("returns empty for unrecognized experience level (runtime safety)", () => {
    // At runtime, corrupted localStorage could pass an invalid level string
    const filtered = filterWidgetsByLevel(ALL_WIDGETS, "invalid" as never);
    expect(filtered).toEqual([]);
  });
});
