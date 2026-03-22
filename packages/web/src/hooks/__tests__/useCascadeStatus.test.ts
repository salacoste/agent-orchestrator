/**
 * useCascadeStatus hook tests (Story 40.1).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCascadeStatus } from "../useCascadeStatus";

// Mock fetch for resume endpoint
const mockFetch = vi.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal("fetch", mockFetch);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCascadeStatus", () => {
  it("starts with null status", () => {
    const { result } = renderHook(() => useCascadeStatus());
    expect(result.current.status).toBeNull();
  });

  it("updates status when onCascadeTriggered is called", () => {
    const { result } = renderHook(() => useCascadeStatus());

    act(() => {
      result.current.onCascadeTriggered({ failureCount: 3 });
    });

    expect(result.current.status).toEqual({
      triggered: true,
      failureCount: 3,
      paused: true,
    });
  });

  it("resume() clears status and calls API", () => {
    const { result } = renderHook(() => useCascadeStatus());

    act(() => {
      result.current.onCascadeTriggered({ failureCount: 3 });
    });
    expect(result.current.status).not.toBeNull();

    act(() => {
      result.current.resume();
    });

    expect(result.current.status).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith("/api/agent/cascade/resume", { method: "POST" });
  });

  it("auto-clears status after 30s of no cascade events", () => {
    const { result } = renderHook(() => useCascadeStatus());

    act(() => {
      result.current.onCascadeTriggered({ failureCount: 3 });
    });
    expect(result.current.status).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.status).toBeNull();
  });

  it("resets auto-clear timer on new cascade event", () => {
    const { result } = renderHook(() => useCascadeStatus());

    act(() => {
      result.current.onCascadeTriggered({ failureCount: 3 });
    });

    // Advance 20s (not enough to auto-clear)
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(result.current.status).not.toBeNull();

    // New event resets the timer
    act(() => {
      result.current.onCascadeTriggered({ failureCount: 4 });
    });

    // Advance another 20s (only 20s past new event)
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(result.current.status).not.toBeNull();
    expect(result.current.status?.failureCount).toBe(4);

    // Full 30s from last event
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.status).toBeNull();
  });

  it("resume() clears auto-clear timer", () => {
    const { result } = renderHook(() => useCascadeStatus());

    act(() => {
      result.current.onCascadeTriggered({ failureCount: 3 });
    });

    act(() => {
      result.current.resume();
    });

    // Advance past auto-clear — should not re-trigger anything
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.status).toBeNull();
    // fetch called exactly once (from resume, not from timer)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("exposes onCascadeTriggered for SSE handler wiring", () => {
    const { result } = renderHook(() => useCascadeStatus());
    expect(typeof result.current.onCascadeTriggered).toBe("function");
  });
});
