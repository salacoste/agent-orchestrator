/**
 * LogStream component tests (Story 44.3).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LogStream } from "../LogStream";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ logs: ["line 1", "line 2", "line 3"] }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LogStream", () => {
  it("renders log stream container", () => {
    render(<LogStream agentId="agent-1" />);

    expect(screen.getByTestId("log-stream")).toBeInTheDocument();
    expect(screen.getByText("Logs: agent-1")).toBeInTheDocument();
  });

  it("loads initial log lines on mount", async () => {
    render(<LogStream agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText(/line 1/)).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/agent/agent-1/logs"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("renders copy button", () => {
    render(<LogStream agentId="agent-1" />);

    expect(screen.getByTestId("log-copy-button")).toBeInTheDocument();
    expect(screen.getByText("Copy All")).toBeInTheDocument();
  });

  it("uses monospace font for log content", async () => {
    render(<LogStream agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText(/line 1/)).toBeInTheDocument();
    });

    const pre = screen.getByTestId("log-content").querySelector("pre");
    expect(pre?.className).toContain("font-mono");
  });

  it("shows loading state when no lines", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => new Promise(() => {}), // Never resolves
    });

    render(<LogStream agentId="agent-1" />);

    expect(screen.getByText("Loading logs...")).toBeInTheDocument();
  });

  it("shows empty state when no logs available", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ logs: [] }),
    });

    render(<LogStream agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText("No logs available.")).toBeInTheDocument();
    });
  });

  it("displays agent ID in header", () => {
    render(<LogStream agentId="my-agent-42" />);

    expect(screen.getByText("Logs: my-agent-42")).toBeInTheDocument();
  });
});
