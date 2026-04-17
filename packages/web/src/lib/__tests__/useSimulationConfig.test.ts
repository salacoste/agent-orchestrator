/**
 * useSimulationConfig hook tests — localStorage round-trip (Story 55.6).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSimulationConfig, DEFAULT_SIMULATION_CONFIG } from "../useSimulationConfig";

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

describe("useSimulationConfig", () => {
  it("returns defaults when localStorage is empty", () => {
    const { result } = renderHook(() => useSimulationConfig("proj1"));
    expect(result.current.config).toEqual(DEFAULT_SIMULATION_CONFIG);
  });

  it("loads saved config from localStorage", () => {
    store.set(
      "ao:sim-config:proj1",
      JSON.stringify({
        simulations: 10000,
        confidenceLevels: ["p50"],
        throughputWindowDays: 60,
        excludeWeekends: false,
      }),
    );

    const { result } = renderHook(() => useSimulationConfig("proj1"));
    expect(result.current.config.simulations).toBe(10000);
    expect(result.current.config.confidenceLevels).toEqual(["p50"]);
    expect(result.current.config.throughputWindowDays).toBe(60);
    expect(result.current.config.excludeWeekends).toBe(false);
  });

  it("persists config changes to localStorage after debounce", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSimulationConfig("proj1"));

    const next = {
      simulations: 20000,
      confidenceLevels: ["p80"] as string[],
      throughputWindowDays: 90,
      excludeWeekends: true,
    };

    act(() => {
      result.current.setConfig(next);
    });

    // Not yet persisted (300ms debounce)
    expect(store.get("ao:sim-config:proj1")).toBeUndefined();

    act(() => {
      vi.advanceTimersByTime(350);
    });

    const saved = JSON.parse(store.get("ao:sim-config:proj1")!);
    expect(saved.simulations).toBe(20000);
    expect(saved.confidenceLevels).toEqual(["p80"]);

    vi.useRealTimers();
  });

  it("clears localStorage on reset", () => {
    store.set("ao:sim-config:proj1", JSON.stringify({ simulations: 9999 }));
    const { result } = renderHook(() => useSimulationConfig("proj1"));

    act(() => {
      result.current.reset();
    });

    expect(store.has("ao:sim-config:proj1")).toBe(false);
    expect(result.current.config).toEqual(DEFAULT_SIMULATION_CONFIG);
  });

  it("reloads config when projectId changes", () => {
    store.set("ao:sim-config:alpha", JSON.stringify({ simulations: 1111 }));
    store.set("ao:sim-config:beta", JSON.stringify({ simulations: 2222 }));

    const { result, rerender } = renderHook(
      ({ pid }: { pid: string }) => useSimulationConfig(pid),
      { initialProps: { pid: "alpha" } },
    );

    expect(result.current.config.simulations).toBe(1111);

    rerender({ pid: "beta" });
    expect(result.current.config.simulations).toBe(2222);
  });
});
