/**
 * Approvals API route tests (Story 46b.2).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockApprovalService = {
  getPending: vi.fn(() => [
    { id: "a-1", action: "spawn", target: "agent-1", status: "pending", requestedBy: "alice" },
  ]),
  approve: vi.fn((id: string, by: string) => ({
    success: true as boolean,
    approval: { id, action: "spawn", target: "agent-1", status: "approved", resolvedBy: by },
    error: undefined as string | undefined,
  })),
  reject: vi.fn((id: string, by: string) => ({
    success: true,
    approval: { id, action: "spawn", target: "agent-1", status: "rejected", resolvedBy: by },
  })),
};

vi.mock("@composio/ao-core", () => ({
  createApprovalService: vi.fn(() => mockApprovalService),
}));

// Must import AFTER mock setup
const { GET } = await import("./route");
const { POST: approvePost } = await import("./[id]/approve/route");
const { POST: rejectPost } = await import("./[id]/reject/route");

beforeEach(() => {
  vi.clearAllMocks();
  mockApprovalService.getPending.mockReturnValue([
    { id: "a-1", action: "spawn", target: "agent-1", status: "pending", requestedBy: "alice" },
  ]);
});

describe("GET /api/approvals", () => {
  it("returns pending approvals", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.approvals).toHaveLength(1);
    expect(data.approvals[0].action).toBe("spawn");
  });
});

describe("POST /api/approvals/{id}/approve", () => {
  it("approves pending action", async () => {
    const request = new Request("http://localhost/api/approvals/a-1/approve", {
      method: "POST",
      headers: { "X-AO-User": "bob" },
    });

    const response = await approvePost(request, { params: Promise.resolve({ id: "a-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("approved");
    expect(data.resolvedBy).toBe("bob");
  });

  it("returns 400 for failed approval", async () => {
    mockApprovalService.approve.mockReturnValue({
      success: false,
      approval: { id: "bad", action: "", target: "", status: "pending", resolvedBy: "" },
      error: "Not found",
    });

    const request = new Request("http://localhost/api/approvals/bad/approve", {
      method: "POST",
    });

    const response = await approvePost(request, { params: Promise.resolve({ id: "bad" }) });
    expect(response.status).toBe(400);
  });
});

describe("POST /api/approvals/{id}/reject", () => {
  it("rejects pending action", async () => {
    const request = new Request("http://localhost/api/approvals/a-1/reject", {
      method: "POST",
      headers: { "X-AO-User": "charlie" },
    });

    const response = await rejectPost(request, { params: Promise.resolve({ id: "a-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("rejected");
  });
});
