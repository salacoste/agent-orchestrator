import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { CommandPalette } from "../CommandPalette";

const mockActions = [
  {
    id: "spawn",
    label: "Spawn Agent",
    description: "Start a new agent",
    category: "Fleet",
    action: vi.fn(),
  },
  {
    id: "status",
    label: "Show Status",
    description: "View sprint status",
    category: "Sprint",
    action: vi.fn(),
  },
  { id: "fleet", label: "Fleet View", category: "Navigation", action: vi.fn() },
];

describe("CommandPalette", () => {
  it("is hidden by default", () => {
    render(<CommandPalette actions={mockActions} />);
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
  });

  it("opens on Ctrl+K", () => {
    render(<CommandPalette actions={mockActions} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
  });

  it("shows all actions when no query", () => {
    render(<CommandPalette actions={mockActions} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("palette-action-spawn")).toBeInTheDocument();
    expect(screen.getByTestId("palette-action-status")).toBeInTheDocument();
    expect(screen.getByTestId("palette-action-fleet")).toBeInTheDocument();
  });

  it("filters actions by query", () => {
    render(<CommandPalette actions={mockActions} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const input = screen.getByTestId("palette-input");
    fireEvent.change(input, { target: { value: "spawn" } });

    expect(screen.getByTestId("palette-action-spawn")).toBeInTheDocument();
    expect(screen.queryByTestId("palette-action-status")).not.toBeInTheDocument();
  });

  it("executes action on click and closes", () => {
    render(<CommandPalette actions={mockActions} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    fireEvent.click(screen.getByTestId("palette-action-spawn"));
    expect(mockActions[0].action).toHaveBeenCalled();
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<CommandPalette actions={mockActions} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    render(<CommandPalette actions={mockActions} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    fireEvent.click(screen.getByTestId("palette-backdrop"));
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
  });

  it("shows no results message when query matches nothing", () => {
    render(<CommandPalette actions={mockActions} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    fireEvent.change(screen.getByTestId("palette-input"), { target: { value: "zzzzz" } });
    expect(screen.getByText("No matching commands")).toBeInTheDocument();
  });
});
