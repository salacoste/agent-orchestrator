/**
 * MobileStatusBar component tests (Story 44.8).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MobileStatusBar } from "../MobileStatusBar";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        metadata: {
          progressPercent: 75,
          activeAgents: 3,
          blockerCount: 1,
        },
      }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MobileStatusBar", () => {
  it("renders status bar container", () => {
    render(<MobileStatusBar />);

    expect(screen.getByTestId("mobile-status-bar")).toBeInTheDocument();
  });

  it("shows health percentage after data loads", async () => {
    render(<MobileStatusBar />);

    await waitFor(() => {
      expect(screen.getByTestId("mobile-health")).toHaveTextContent("75%");
    });
  });

  it("shows active agent count", async () => {
    render(<MobileStatusBar />);

    await waitFor(() => {
      expect(screen.getByTestId("mobile-agents")).toHaveTextContent("3 agents");
    });
  });

  it("shows blocker count when present", async () => {
    render(<MobileStatusBar />);

    await waitFor(() => {
      expect(screen.getByTestId("mobile-blockers")).toHaveTextContent("1 blocker");
    });
  });

  it("hides blocker badge when zero blockers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          metadata: { progressPercent: 100, activeAgents: 0, blockerCount: 0 },
        }),
    });

    render(<MobileStatusBar />);

    await waitFor(() => {
      expect(screen.getByTestId("mobile-health")).toHaveTextContent("100%");
    });

    expect(screen.queryByTestId("mobile-blockers")).not.toBeInTheDocument();
  });

  it("shows placeholder when data is not yet loaded", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves

    render(<MobileStatusBar />);

    expect(screen.getByTestId("mobile-health")).toHaveTextContent("—");
    expect(screen.getByTestId("mobile-agents")).toHaveTextContent("—");
  });

  it("handles fetch failure gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Offline"));

    render(<MobileStatusBar />);

    // Should still render with placeholder — no crash
    expect(screen.getByTestId("mobile-status-bar")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-health")).toHaveTextContent("—");
  });

  it("uses singular 'agent' for count of 1", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          metadata: { progressPercent: 50, activeAgents: 1, blockerCount: 0 },
        }),
    });

    render(<MobileStatusBar />);

    await waitFor(() => {
      expect(screen.getByTestId("mobile-agents")).toHaveTextContent("1 agent");
    });

    // Should NOT say "1 agents"
    expect(screen.getByTestId("mobile-agents").textContent).not.toContain("agents");
  });
});

describe("manifest.json structure", () => {
  it("has required PWA fields", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const manifestPath = path.resolve(__dirname, "../../../public/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;

    expect(manifest.name).toBe("Agent Orchestrator");
    expect(manifest.short_name).toBe("AO");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect((manifest.icons as Array<{ sizes: string }>).length).toBeGreaterThanOrEqual(2);
  });
});
