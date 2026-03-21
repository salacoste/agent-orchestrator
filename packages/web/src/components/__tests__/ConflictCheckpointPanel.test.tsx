import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ConflictCheckpointPanel } from "../ConflictCheckpointPanel";

describe("ConflictCheckpointPanel", () => {
  it("renders empty state", () => {
    render(<ConflictCheckpointPanel conflicts={[]} timeline={null} />);
    expect(screen.getByText("No conflicts or checkpoints to display.")).toBeInTheDocument();
  });

  it("renders file conflicts", () => {
    render(
      <ConflictCheckpointPanel
        conflicts={[{ filePath: "src/types.ts", agentA: "agent-1", agentB: "agent-2" }]}
        timeline={null}
      />,
    );
    expect(screen.getByTestId("conflict-list")).toBeInTheDocument();
    expect(screen.getByText("src/types.ts")).toBeInTheDocument();
    expect(screen.getByText(/agent-1 vs agent-2/)).toBeInTheDocument();
  });

  it("renders checkpoint timeline", () => {
    render(
      <ConflictCheckpointPanel
        conflicts={[]}
        timeline={{
          agentId: "agent-1",
          checkpoints: [
            {
              sha: "abc1234567",
              timestamp: "2026-03-21T01:00:00Z",
              filesChanged: 3,
              message: "WIP",
            },
            {
              sha: "def7890123",
              timestamp: "2026-03-21T01:10:00Z",
              filesChanged: 1,
              message: "WIP",
            },
          ],
          enabled: true,
          intervalMinutes: 10,
        }}
      />,
    );
    expect(screen.getByTestId("checkpoint-timeline")).toBeInTheDocument();
    expect(screen.getByText("abc1234")).toBeInTheDocument();
    expect(screen.getByText("3 files")).toBeInTheDocument();
  });

  it("calls onRollback when rollback button clicked", () => {
    const onRollback = vi.fn();
    render(
      <ConflictCheckpointPanel
        conflicts={[]}
        timeline={{
          agentId: "agent-1",
          checkpoints: [
            {
              sha: "abc1234567",
              timestamp: "2026-03-21T01:00:00Z",
              filesChanged: 2,
              message: "WIP",
            },
          ],
          enabled: true,
          intervalMinutes: 10,
        }}
        onRollback={onRollback}
      />,
    );

    fireEvent.click(screen.getByTestId("rollback-abc1234"));
    expect(onRollback).toHaveBeenCalledWith("abc1234567");
  });

  it("has accessible section label", () => {
    render(<ConflictCheckpointPanel conflicts={[]} timeline={null} />);
    expect(screen.getByRole("region", { name: "Conflicts and checkpoints" })).toBeInTheDocument();
  });
});
