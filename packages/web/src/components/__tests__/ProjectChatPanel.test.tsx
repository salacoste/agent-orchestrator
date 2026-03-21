import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ProjectChatPanel } from "../ProjectChatPanel";

const mockInsights = [
  { id: "blocked", text: "2 stories are blocked", severity: "action" as const },
  { id: "behind", text: "Sprint is 30% complete", severity: "warning" as const },
  { id: "ok", text: "Agents running smoothly", severity: "info" as const },
];

describe("ProjectChatPanel", () => {
  it("renders insights as chat bubbles", () => {
    render(<ProjectChatPanel insights={mockInsights} />);
    expect(screen.getByTestId("insight-blocked")).toHaveTextContent("2 stories are blocked");
    expect(screen.getByTestId("insight-behind")).toHaveTextContent("Sprint is 30% complete");
    expect(screen.getByTestId("insight-ok")).toHaveTextContent("Agents running smoothly");
  });

  it("shows empty state when no insights", () => {
    render(<ProjectChatPanel insights={[]} />);
    expect(screen.getByText(/No insights yet/)).toBeInTheDocument();
  });

  it("renders chat input at bottom", () => {
    render(<ProjectChatPanel insights={[]} />);
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
    expect(screen.getByTestId("chat-send")).toBeInTheDocument();
  });

  it("calls onAskQuestion when send clicked", () => {
    const onAsk = vi.fn();
    render(<ProjectChatPanel insights={[]} onAskQuestion={onAsk} />);

    const input = screen.getByTestId("chat-input");
    fireEvent.change(input, { target: { value: "What's blocking?" } });
    fireEvent.click(screen.getByTestId("chat-send"));

    expect(onAsk).toHaveBeenCalledWith("What's blocking?");
  });

  it("clears input after sending", () => {
    render(<ProjectChatPanel insights={[]} onAskQuestion={vi.fn()} />);

    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(screen.getByTestId("chat-send"));

    expect(input.value).toBe("");
  });

  it("send button disabled when input empty", () => {
    render(<ProjectChatPanel insights={[]} />);
    expect(screen.getByTestId("chat-send")).toBeDisabled();
  });

  it("color-codes insights by severity", () => {
    render(<ProjectChatPanel insights={mockInsights} />);
    expect(screen.getByTestId("insight-blocked").className).toContain("red");
    expect(screen.getByTestId("insight-behind").className).toContain("amber");
  });
});
