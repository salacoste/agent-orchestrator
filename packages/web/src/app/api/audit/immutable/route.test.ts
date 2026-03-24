/**
 * Immutable audit log API route tests (Story 46a.1).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@composio/ao-core", () => ({
  createImmutableAuditLog: vi.fn(() => ({
    readEntries: vi.fn(async () => [
      {
        id: "1",
        timestamp: "2026-03-24T10:00:00Z",
        actor: "user",
        action: "spawn",
        target: "agent-1",
        hash: "abc123",
        previousHash: "0",
      },
    ]),
    verify: vi.fn(async () => ({ valid: true, entriesChecked: 1 })),
  })),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/audit/immutable", () => {
  it("returns audit entries", async () => {
    const response = await GET(new Request("http://localhost/api/audit/immutable"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].actor).toBe("user");
    expect(data.entries[0].action).toBe("spawn");
    expect(data.entries[0].hash).toBe("abc123");
  });

  it("returns chain verification when verify=true", async () => {
    const response = await GET(new Request("http://localhost/api/audit/immutable?verify=true"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.entriesChecked).toBe(1);
  });

  it("passes since and limit params", async () => {
    const response = await GET(
      new Request("http://localhost/api/audit/immutable?since=2026-03-01T00:00:00Z&limit=50"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.entries).toBeDefined();
  });
});
