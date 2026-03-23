/**
 * SplitPane + useSplitView tests (Story 44.2).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { SplitPane } from "../SplitPane";
import { useSplitView } from "../../hooks/useSplitView";

describe("SplitPane", () => {
  it("renders left and right panes", () => {
    render(<SplitPane left={<div>Left Content</div>} right={<div>Right Content</div>} />);

    expect(screen.getByText("Left Content")).toBeInTheDocument();
    expect(screen.getByText("Right Content")).toBeInTheDocument();
    expect(screen.getByTestId("split-pane-left")).toBeInTheDocument();
    expect(screen.getByTestId("split-pane-right")).toBeInTheDocument();
  });

  it("renders drag handle", () => {
    render(<SplitPane left={<div>L</div>} right={<div>R</div>} />);

    expect(screen.getByTestId("split-pane-handle")).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("renders close button when onClose provided", () => {
    const onClose = vi.fn();
    render(<SplitPane left={<div>L</div>} right={<div>R</div>} onClose={onClose} />);

    const closeBtn = screen.getByTestId("split-pane-close");
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render close button without onClose", () => {
    render(<SplitPane left={<div>L</div>} right={<div>R</div>} />);

    expect(screen.queryByTestId("split-pane-close")).not.toBeInTheDocument();
  });

  it("sets initial split percentage", () => {
    render(<SplitPane left={<div>L</div>} right={<div>R</div>} initialSplit={30} />);

    const leftPane = screen.getByTestId("split-pane-left");
    expect(leftPane.style.width).toBe("30%");
  });
});

describe("useSplitView", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useSplitView());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.agentId).toBeNull();
  });

  it("opens with agent ID", () => {
    const { result } = renderHook(() => useSplitView());

    act(() => {
      result.current.open("agent-1");
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.agentId).toBe("agent-1");
  });

  it("closes and clears agent ID", () => {
    const { result } = renderHook(() => useSplitView());

    act(() => {
      result.current.open("agent-1");
    });
    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.agentId).toBeNull();
  });

  it("closes on Escape key", () => {
    const { result } = renderHook(() => useSplitView());

    act(() => {
      result.current.open("agent-1");
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("does not respond to Escape when closed", () => {
    const { result } = renderHook(() => useSplitView());

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.agentId).toBeNull();
  });
});
