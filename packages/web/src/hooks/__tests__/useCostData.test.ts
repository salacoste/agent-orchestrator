/**
 * useCostData hook tests (Story 60.6).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const MOCK_SUMMARY = {
  dimension: "summary" as const,
  totalTokens: 150000,
  totalCost: 0.45,
  byTier: {
    low: { tokens: 10000, cost: 0.01, sessions: 2 },
    medium: { tokens: 100000, cost: 0.3, sessions: 5 },
    high: { tokens: 40000, cost: 0.14, sessions: 1 },
  },
};

describe("useCostData", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Dynamic import to get fresh module with current global.fetch
  async function loadHook() {
    // Bust module cache by importing fresh
    vi.resetModules();
    const mod = await import("../useCostData");
    return mod.useCostData;
  }

  it("returns null summary initially with loading true", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const useCostData = await loadHook();
    const { result } = renderHook(() => useCostData());

    expect(result.current.summary).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("fetches summary on mount and updates state", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_SUMMARY),
    });
    const useCostData = await loadHook();
    const { result } = renderHook(() => useCostData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary).toEqual(MOCK_SUMMARY);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/costs/breakdown?dimension=summary",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("sets loading to false after successful fetch", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_SUMMARY),
    });
    const useCostData = await loadHook();
    const { result } = renderHook(() => useCostData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("retains previous data on fetch failure", async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_SUMMARY),
    });
    const useCostData = await loadHook();
    const { result } = renderHook(() => useCostData());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.summary).toEqual(MOCK_SUMMARY);

    // Second fetch fails
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    // Previous data retained
    expect(result.current.summary).toEqual(MOCK_SUMMARY);
    expect(result.current.error).toBe("Failed to fetch cost data");
  });

  it("clears interval and abort controller on unmount", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    mockFetch.mockReturnValue(new Promise(() => {}));
    const useCostData = await loadHook();
    const { unmount } = renderHook(() => useCostData());

    unmount();

    expect(abortSpy).toHaveBeenCalled();
    abortSpy.mockRestore();
  });

  it("re-fetches on 30-second interval", async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_SUMMARY),
    });
    const useCostData = await loadHook();
    renderHook(() => useCostData());

    // Initial fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // After 30 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // After another 30 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("sets error on HTTP error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });
    const useCostData = await loadHook();
    const { result } = renderHook(() => useCostData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBe("Failed to fetch cost data");
  });

  it("sets error when response has invalid shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ dimension: "summary", totalTokens: "bad" }),
    });
    const useCostData = await loadHook();
    const { result } = renderHook(() => useCostData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBe("Invalid cost data received");
  });

  it("sets error when response is missing byTier", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ dimension: "summary", totalTokens: 100, totalCost: 0.1 }),
    });
    const useCostData = await loadHook();
    const { result } = renderHook(() => useCostData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBe("Invalid cost data received");
  });
});
