/**
 * Approval service tests (Story 46b.2).
 */
import { describe, expect, it } from "vitest";
import { createApprovalService } from "../approval-service.js";
import { getDefaultConfig, validateConfig } from "../config.js";

describe("createApprovalService", () => {
  it("creates pending approval request", () => {
    const svc = createApprovalService();
    const req = svc.requestApproval("spawn", "agent-1", "alice");

    expect(req.id).toBeTruthy();
    expect(req.action).toBe("spawn");
    expect(req.target).toBe("agent-1");
    expect(req.requestedBy).toBe("alice");
    expect(req.status).toBe("pending");
  });

  it("approves pending request", () => {
    const svc = createApprovalService();
    const req = svc.requestApproval("spawn", "agent-1", "alice");

    const result = svc.approve(req.id, "bob");

    expect(result.success).toBe(true);
    expect(result.approval.status).toBe("approved");
    expect(result.approval.resolvedBy).toBe("bob");
    expect(result.approval.resolvedAt).toBeTruthy();
  });

  it("rejects pending request", () => {
    const svc = createApprovalService();
    const req = svc.requestApproval("kill", "agent-2", "alice");

    const result = svc.reject(req.id, "charlie");

    expect(result.success).toBe(true);
    expect(result.approval.status).toBe("rejected");
    expect(result.approval.resolvedBy).toBe("charlie");
  });

  it("returns error for unknown approval ID", () => {
    const svc = createApprovalService();
    const result = svc.approve("nonexistent", "bob");

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("cannot approve already approved request", () => {
    const svc = createApprovalService();
    const req = svc.requestApproval("spawn", "agent-1", "alice");
    svc.approve(req.id, "bob");

    const result = svc.approve(req.id, "charlie");

    expect(result.success).toBe(false);
    expect(result.error).toContain("approved");
  });

  it("cannot reject already rejected request", () => {
    const svc = createApprovalService();
    const req = svc.requestApproval("spawn", "agent-1", "alice");
    svc.reject(req.id, "bob");

    const result = svc.reject(req.id, "charlie");

    expect(result.success).toBe(false);
  });

  it("returns pending approvals", () => {
    const svc = createApprovalService();
    svc.requestApproval("spawn", "a-1", "alice");
    svc.requestApproval("kill", "a-2", "bob");
    const req3 = svc.requestApproval("spawn", "a-3", "charlie");
    svc.approve(req3.id, "alice");

    const pending = svc.getPending();
    expect(pending).toHaveLength(2); // a-3 was approved
  });

  it("returns all approvals including resolved", () => {
    const svc = createApprovalService();
    svc.requestApproval("spawn", "a-1", "alice");
    const req2 = svc.requestApproval("kill", "a-2", "bob");
    svc.reject(req2.id, "alice");

    const all = svc.getAll();
    expect(all).toHaveLength(2);
  });

  it("checks if approval is required for action", () => {
    const svc = createApprovalService();

    expect(svc.isApprovalRequired("spawn", ["spawn", "kill"])).toBe(true);
    expect(svc.isApprovalRequired("resume", ["spawn", "kill"])).toBe(false);
    expect(svc.isApprovalRequired("spawn", [])).toBe(false);
  });

  it("supports optional timeout", () => {
    const svc = createApprovalService();
    const req = svc.requestApproval("spawn", "a-1", "alice", 5000);

    expect(req.timeoutMs).toBe(5000);
  });
});

describe("approvalRequired config schema", () => {
  it("defaults to empty array", () => {
    const config = getDefaultConfig();
    expect(config.approvalRequired).toEqual([]);
  });

  it("accepts valid approval actions", () => {
    const config = validateConfig({
      projects: {},
      approvalRequired: ["spawn", "kill"],
    });
    expect(config.approvalRequired).toEqual(["spawn", "kill"]);
  });

  it("rejects invalid action names", () => {
    expect(() =>
      validateConfig({
        projects: {},
        approvalRequired: ["destroy"],
      }),
    ).toThrow();
  });
});
