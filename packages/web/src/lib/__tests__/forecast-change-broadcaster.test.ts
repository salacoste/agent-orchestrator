import { describe, it, expect, beforeEach } from "vitest";
import {
  subscribeForecastChanges,
  broadcastForecastChange,
  _resetForecastChangeBroadcaster,
} from "../forecast-change-broadcaster.js";
import type { ForecastDiff } from "@composio/ao-plugin-tracker-bmad";

const MOCK_DIFF: ForecastDiff = {
  p50Shift: 5,
  p80Shift: 3,
  p95Shift: 2,
  significantChange: true,
  direction: "later",
};

describe("forecast-change-broadcaster", () => {
  beforeEach(() => {
    _resetForecastChangeBroadcaster();
  });

  it("broadcasts forecast changes to subscribers", () => {
    const received: Array<{ projectId: string; diff: ForecastDiff; newP50: string }> = [];
    subscribeForecastChanges((projectId, diff, newP50) => {
      received.push({ projectId, diff, newP50 });
    });

    broadcastForecastChange("project-1", MOCK_DIFF, "2026-05-01");

    expect(received).toHaveLength(1);
    expect(received[0]!.projectId).toBe("project-1");
    expect(received[0]!.diff).toBe(MOCK_DIFF);
    expect(received[0]!.newP50).toBe("2026-05-01");
  });

  it("unsubscribe removes the listener", () => {
    const received: unknown[] = [];
    const unsub = subscribeForecastChanges((...args) => {
      received.push(args);
    });

    unsub();
    broadcastForecastChange("project-1", MOCK_DIFF, "2026-05-01");

    expect(received).toHaveLength(0);
  });

  it("broadcasts to multiple subscribers", () => {
    const received1: unknown[] = [];
    const received2: unknown[] = [];
    subscribeForecastChanges((...args) => received1.push(args));
    subscribeForecastChanges((...args) => received2.push(args));

    broadcastForecastChange("project-1", MOCK_DIFF, "2026-05-01");

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });

  it("continues broadcast if one listener throws", () => {
    const received: unknown[] = [];
    subscribeForecastChanges(() => {
      throw new Error("boom");
    });
    subscribeForecastChanges((...args) => received.push(args));

    broadcastForecastChange("project-1", MOCK_DIFF, "2026-05-01");

    expect(received).toHaveLength(1);
  });

  it("does not receive events after unsubscribe", () => {
    const received: unknown[] = [];
    const unsub = subscribeForecastChanges((...args) => received.push(args));

    broadcastForecastChange("project-1", MOCK_DIFF, "2026-05-01");
    unsub();
    broadcastForecastChange("project-1", MOCK_DIFF, "2026-05-02");

    expect(received).toHaveLength(1);
  });
});
