/**
 * Agent negotiation tests (Story 47.1).
 */
import { describe, expect, it } from "vitest";
import {
  createNegotiationRequest,
  evaluateNegotiation,
  resolveOutcome,
  DEFAULT_TIMEOUT_MS,
  NEGOTIATION_CHANNEL,
} from "../agent-negotiation.js";

describe("createNegotiationRequest", () => {
  it("creates request with all fields", () => {
    const req = createNegotiationRequest("agent-A", "agent-B", ["src/auth.ts", "src/db.ts"]);

    expect(req.requesterId).toBe("agent-A");
    expect(req.targetId).toBe("agent-B");
    expect(req.conflictFiles).toEqual(["src/auth.ts", "src/db.ts"]);
    expect(req.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(req.requestedAt).toBeTruthy();
  });

  it("uses custom timeout", () => {
    const req = createNegotiationRequest("a", "b", ["f.ts"], 5000);
    expect(req.timeoutMs).toBe(5000);
  });

  it("default timeout is 2 minutes", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(120_000);
  });

  it("channel name is agent.negotiation", () => {
    expect(NEGOTIATION_CHANNEL).toBe("agent.negotiation");
  });
});

describe("evaluateNegotiation", () => {
  it("accepts when no conflict files are required", () => {
    const req = createNegotiationRequest("a", "b", ["src/auth.ts"]);
    const resp = evaluateNegotiation(req, ["src/other.ts"]);

    expect(resp.accepted).toBe(true);
    expect(resp.escalate).toBe(false);
    expect(resp.adjustedFiles).toEqual(["src/auth.ts"]);
  });

  it("rejects when all conflict files are required", () => {
    const req = createNegotiationRequest("a", "b", ["src/auth.ts"]);
    const resp = evaluateNegotiation(req, ["src/auth.ts"]);

    expect(resp.accepted).toBe(false);
    expect(resp.escalate).toBe(true); // Can't avoid any → escalate
  });

  it("partially accepts when some files avoidable", () => {
    const req = createNegotiationRequest("a", "b", ["src/auth.ts", "src/utils.ts"]);
    const resp = evaluateNegotiation(req, ["src/auth.ts"]);

    expect(resp.accepted).toBe(false); // Still needs auth.ts
    expect(resp.escalate).toBe(false); // Can avoid utils.ts
    expect(resp.adjustedFiles).toEqual(["src/utils.ts"]);
  });

  it("includes requester and target IDs", () => {
    const req = createNegotiationRequest("agent-1", "agent-2", []);
    const resp = evaluateNegotiation(req, []);

    expect(resp.requesterId).toBe("agent-1");
    expect(resp.targetId).toBe("agent-2");
    expect(resp.respondedAt).toBeTruthy();
  });

  it("accepts with empty conflict list", () => {
    const req = createNegotiationRequest("a", "b", []);
    const resp = evaluateNegotiation(req, ["src/anything.ts"]);

    expect(resp.accepted).toBe(true);
  });
});

describe("resolveOutcome", () => {
  it("returns timeout when timed out", () => {
    expect(resolveOutcome(null, true)).toBe("timeout");
  });

  it("returns timeout when no response", () => {
    expect(resolveOutcome(null, false)).toBe("timeout");
  });

  it("returns escalated when response escalates", () => {
    const resp = {
      requesterId: "a",
      targetId: "b",
      accepted: false,
      adjustedFiles: [],
      escalate: true,
      respondedAt: new Date().toISOString(),
    };
    expect(resolveOutcome(resp, false)).toBe("escalated");
  });

  it("returns agreed when accepted", () => {
    const resp = {
      requesterId: "a",
      targetId: "b",
      accepted: true,
      adjustedFiles: ["f.ts"],
      escalate: false,
      respondedAt: new Date().toISOString(),
    };
    expect(resolveOutcome(resp, false)).toBe("agreed");
  });

  it("returns rejected when not accepted and not escalated", () => {
    const resp = {
      requesterId: "a",
      targetId: "b",
      accepted: false,
      adjustedFiles: ["f.ts"],
      escalate: false,
      respondedAt: new Date().toISOString(),
    };
    expect(resolveOutcome(resp, false)).toBe("rejected");
  });

  it("timeout takes priority over response", () => {
    const resp = {
      requesterId: "a",
      targetId: "b",
      accepted: true,
      adjustedFiles: [],
      escalate: false,
      respondedAt: new Date().toISOString(),
    };
    expect(resolveOutcome(resp, true)).toBe("timeout");
  });
});
