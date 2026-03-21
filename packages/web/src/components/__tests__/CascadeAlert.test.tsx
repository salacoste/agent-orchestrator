import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { CascadeAlert } from "../CascadeAlert";

describe("CascadeAlert", () => {
  it("renders nothing when status is null", () => {
    const { container } = render(<CascadeAlert status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when not paused", () => {
    const { container } = render(
      <CascadeAlert status={{ triggered: false, failureCount: 1, paused: false }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders alert when paused", () => {
    render(<CascadeAlert status={{ triggered: true, failureCount: 4, paused: true }} />);

    expect(screen.getByTestId("cascade-alert")).toBeInTheDocument();
    expect(screen.getByText(/Cascade Failure Detected/)).toBeInTheDocument();
    expect(screen.getByText(/4 agent failures/)).toBeInTheDocument();
  });

  it("renders Resume All button when onResume provided", () => {
    const onResume = vi.fn();
    render(
      <CascadeAlert
        status={{ triggered: true, failureCount: 3, paused: true }}
        onResume={onResume}
      />,
    );

    const button = screen.getByTestId("cascade-resume-button");
    expect(button).toHaveTextContent("Resume All");
    fireEvent.click(button);
    expect(onResume).toHaveBeenCalledOnce();
  });

  it("does not render Resume button when onResume not provided", () => {
    render(<CascadeAlert status={{ triggered: true, failureCount: 3, paused: true }} />);

    expect(screen.queryByTestId("cascade-resume-button")).not.toBeInTheDocument();
  });

  it("has role=alert for accessibility", () => {
    render(<CascadeAlert status={{ triggered: true, failureCount: 3, paused: true }} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
