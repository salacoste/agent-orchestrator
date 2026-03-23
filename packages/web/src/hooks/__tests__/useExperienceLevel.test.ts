/**
 * useExperienceLevel hook tests (Story 44.5).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExperienceLevel } from "../useExperienceLevel";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useExperienceLevel", () => {
  it("returns beginner level with zero days", () => {
    const { result } = renderHook(() => useExperienceLevel());

    // First render records today → dayCount = 1 after effect
    expect(result.current.level).toBe("beginner");
    expect(result.current.expertMode).toBe(false);
  });

  it("records today on mount", () => {
    renderHook(() => useExperienceLevel());

    const days = JSON.parse(store.get("ao-active-days") ?? "[]") as string[];
    expect(days).toHaveLength(1);
    // Should be YYYY-MM-DD format
    expect(days[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not duplicate today on re-render", () => {
    const { rerender } = renderHook(() => useExperienceLevel());
    rerender();
    rerender();

    const days = JSON.parse(store.get("ao-active-days") ?? "[]") as string[];
    expect(days).toHaveLength(1);
  });

  it("returns intermediate for 4-7 days", () => {
    const fakeDays = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"];
    store.set("ao-active-days", JSON.stringify(fakeDays));

    const { result } = renderHook(() => useExperienceLevel());

    // 4 stored days → intermediate (today may add 5th but level check uses state)
    expect(result.current.level).toBe("intermediate");
  });

  it("returns advanced for 8+ days", () => {
    const fakeDays = Array.from(
      { length: 8 },
      (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`,
    );
    store.set("ao-active-days", JSON.stringify(fakeDays));

    const { result } = renderHook(() => useExperienceLevel());

    expect(result.current.level).toBe("advanced");
  });

  it("toggles expert mode", () => {
    const { result } = renderHook(() => useExperienceLevel());

    expect(result.current.expertMode).toBe(false);
    expect(result.current.level).toBe("beginner");

    act(() => {
      result.current.toggleExpertMode();
    });

    expect(result.current.expertMode).toBe(true);
    expect(result.current.level).toBe("expert");
    expect(store.get("ao-expert-mode")).toBe("true");
  });

  it("persists expert mode across renders", () => {
    store.set("ao-expert-mode", "true");

    const { result } = renderHook(() => useExperienceLevel());

    expect(result.current.expertMode).toBe(true);
    expect(result.current.level).toBe("expert");
  });

  it("handles corrupted localStorage data gracefully", () => {
    store.set("ao-active-days", '{"not": "an array"}');

    const { result } = renderHook(() => useExperienceLevel());

    // Corrupted data is discarded; effect records today → dayCount = 1
    expect(result.current.dayCount).toBe(1);
    expect(result.current.level).toBe("beginner");
  });

  it("filters invalid entries from stored days", () => {
    // Mixed valid/invalid entries — only valid YYYY-MM-DD strings count
    store.set(
      "ao-active-days",
      JSON.stringify(["2026-01-01", 123, null, "not-a-date", "2026-01-02"]),
    );

    const { result } = renderHook(() => useExperienceLevel());

    // Only 2 valid entries + today = 3
    expect(result.current.dayCount).toBeLessThanOrEqual(3);
    expect(result.current.level).toBe("beginner");
  });

  it("caps stored days at MAX_TRACKED_DAYS", () => {
    // Fill with 365 entries
    const fakeDays = Array.from({ length: 365 }, (_, i) => {
      const d = new Date(2024, 0, i + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    });
    store.set("ao-active-days", JSON.stringify(fakeDays));

    renderHook(() => useExperienceLevel());

    // After adding today, should trim to 365
    const days = JSON.parse(store.get("ao-active-days") ?? "[]") as string[];
    expect(days.length).toBeLessThanOrEqual(365);
  });

  it("works when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);

    // Should not throw; effect still tracks today in local state
    const { result } = renderHook(() => useExperienceLevel());

    expect(result.current.level).toBe("beginner");
    expect(result.current.dayCount).toBeLessThanOrEqual(1);
  });
});
