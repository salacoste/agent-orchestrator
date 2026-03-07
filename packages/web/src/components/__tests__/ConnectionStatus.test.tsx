import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectionStatus } from "../ConnectionStatus";

describe("ConnectionStatus", () => {
  it("shows green indicator when connected", () => {
    render(<ConnectionStatus connected={true} reconnecting={false} />);

    const indicator = screen.getByLabelText("connection status");
    expect(indicator).toHaveTextContent("🟢");
    expect(screen.getByText("connected")).toBeInTheDocument();
  });

  it("shows red indicator when disconnected", () => {
    render(<ConnectionStatus connected={false} reconnecting={false} />);

    const indicator = screen.getByLabelText("connection status");
    expect(indicator).toHaveTextContent("🔴");
    expect(screen.getByText("disconnected")).toBeInTheDocument();
  });

  it("shows reconnecting message when reconnecting", () => {
    render(<ConnectionStatus connected={false} reconnecting={true} />);

    expect(screen.getByText("Reconnecting to event stream...")).toBeInTheDocument();
  });

  it("hides reconnecting message when connected", () => {
    render(<ConnectionStatus connected={true} reconnecting={true} />);

    expect(screen.queryByText("Reconnecting to event stream...")).not.toBeInTheDocument();
  });

  it("is always visible on mobile (responsive)", () => {
    const { container } = render(<ConnectionStatus connected={true} reconnecting={false} />);

    const statusElement = container.querySelector("[data-testid='connection-status']");
    expect(statusElement).toHaveClass("always-visible");
  });
});
