/**
 * Widget registry tests (Story 44.1).
 */
import { describe, expect, it } from "vitest";
import {
  getWidgetLayout,
  ROLE_LAYOUTS,
  WIDGET_META,
  USER_ROLES,
  type WidgetId,
} from "../widget-registry";

describe("widget-registry", () => {
  it("all roles have defined layouts", () => {
    for (const role of USER_ROLES) {
      const layout = getWidgetLayout(role);
      expect(layout.length).toBeGreaterThan(0);
    }
  });

  it("all widgets in layouts have metadata", () => {
    for (const role of USER_ROLES) {
      const layout = getWidgetLayout(role);
      for (const widgetId of layout) {
        expect(WIDGET_META[widgetId]).toBeDefined();
        expect(WIDGET_META[widgetId].label).toBeTruthy();
      }
    }
  });

  it("dev layout starts with phaseBar", () => {
    const layout = getWidgetLayout("dev");
    expect(layout[0]).toBe("phaseBar");
  });

  it("pm layout includes costPanel but not agents as first widget", () => {
    const layout = getWidgetLayout("pm");
    expect(layout).toContain("costPanel");
    // PM should see cost early (position 2 or 3)
    const costIndex = layout.indexOf("costPanel");
    expect(costIndex).toBeLessThan(4);
  });

  it("lead layout includes both agents and costPanel", () => {
    const layout = getWidgetLayout("lead");
    expect(layout).toContain("agents");
    expect(layout).toContain("costPanel");
  });

  it("all layouts include cascadeAlert (safety-critical)", () => {
    for (const role of USER_ROLES) {
      expect(getWidgetLayout(role)).toContain("cascadeAlert");
    }
  });

  it("WIDGET_META has colSpan for all widgets", () => {
    const widgetIds = Object.keys(WIDGET_META) as WidgetId[];
    for (const id of widgetIds) {
      expect([1, 3]).toContain(WIDGET_META[id].colSpan);
    }
  });

  it("WIDGET_META has minLevel for progressive disclosure", () => {
    const validLevels = ["beginner", "intermediate", "advanced", "expert"];
    const widgetIds = Object.keys(WIDGET_META) as WidgetId[];
    for (const id of widgetIds) {
      expect(validLevels).toContain(WIDGET_META[id].minLevel);
    }
  });

  it("fallback to dev layout for unknown role", () => {
    const layout = getWidgetLayout("unknown" as never);
    expect(layout).toEqual(ROLE_LAYOUTS.dev);
  });
});
