/**
 * Approval service — human gates for risky actions (Story 46b.2).
 *
 * In-memory approval queue. Actions requiring approval enter PENDING
 * state until an authorized user approves or rejects.
 */

import { randomUUID } from "node:crypto";

/** Approval status. */
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

/** A pending or resolved approval request. */
export interface ApprovalRequest {
  id: string;
  action: string;
  target: string;
  requestedBy: string;
  requestedAt: string;
  status: ApprovalStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  timeoutMs?: number;
}

/** Result of approve/reject. */
export interface ApprovalResult {
  success: boolean;
  approval: ApprovalRequest;
  error?: string;
}

/** Approval service interface. */
export interface ApprovalService {
  requestApproval(
    action: string,
    target: string,
    requestedBy: string,
    timeoutMs?: number,
  ): ApprovalRequest;
  approve(id: string, approvedBy: string): ApprovalResult;
  reject(id: string, rejectedBy: string): ApprovalResult;
  getPending(): ApprovalRequest[];
  getAll(): ApprovalRequest[];
  isApprovalRequired(action: string, requiredActions: string[]): boolean;
}

/**
 * Create an in-memory approval service.
 */
/** Max resolved approvals to keep (prune oldest beyond this). */
const MAX_RESOLVED = 500;

/** Max pending approvals to prevent unbounded growth. */
const MAX_PENDING = 200;

export function createApprovalService(): ApprovalService {
  const approvals = new Map<string, ApprovalRequest>();

  /** Check and expire timed-out approvals. */
  function expireTimedOut(): void {
    const now = Date.now();
    for (const approval of approvals.values()) {
      if (approval.status !== "pending" || !approval.timeoutMs) continue;
      const requestedMs = new Date(approval.requestedAt).getTime();
      // Guard invalid requestedAt — treat as already expired
      if (isNaN(requestedMs) || now - requestedMs >= approval.timeoutMs) {
        approval.status = "expired";
      }
    }
  }

  /** Prune resolved entries beyond MAX_RESOLVED. */
  function pruneResolved(): void {
    const resolved = [...approvals.entries()].filter(([, a]) => a.status !== "pending");
    if (resolved.length > MAX_RESOLVED) {
      const toRemove = resolved
        .sort((a, b) => a[1].requestedAt.localeCompare(b[1].requestedAt))
        .slice(0, resolved.length - MAX_RESOLVED);
      for (const [key] of toRemove) approvals.delete(key);
    }
  }

  /** Build error result for not-found approval. */
  function notFoundResult(id: string): ApprovalResult {
    return {
      success: false,
      approval: { id, action: "", target: "", requestedBy: "", requestedAt: "", status: "pending" },
      error: "Approval not found",
    };
  }

  return {
    requestApproval(action, target, requestedBy, timeoutMs) {
      // Expire stale approvals first to free slots
      expireTimedOut();

      // Enforce pending limit to prevent unbounded growth
      const pendingCount = [...approvals.values()].filter((a) => a.status === "pending").length;
      if (pendingCount >= MAX_PENDING) {
        throw new Error(`Pending approval limit reached (${MAX_PENDING})`);
      }

      const approval: ApprovalRequest = {
        id: randomUUID(),
        action,
        target,
        requestedBy,
        requestedAt: new Date().toISOString(),
        status: "pending",
        timeoutMs,
      };
      approvals.set(approval.id, approval);
      return approval;
    },

    approve(id, approvedBy) {
      expireTimedOut(); // Expire before checking status
      const approval = approvals.get(id);
      if (!approval) return notFoundResult(id);
      if (approval.status !== "pending") {
        return { success: false, approval, error: `Cannot approve: status is ${approval.status}` };
      }
      // Prevent self-approval
      if (approval.requestedBy === approvedBy) {
        return { success: false, approval, error: "Cannot approve own request" };
      }
      approval.status = "approved";
      approval.resolvedBy = approvedBy;
      approval.resolvedAt = new Date().toISOString();
      pruneResolved();
      return { success: true, approval };
    },

    reject(id, rejectedBy) {
      expireTimedOut(); // Expire before checking status
      const approval = approvals.get(id);
      if (!approval) return notFoundResult(id);
      if (approval.status !== "pending") {
        return { success: false, approval, error: `Cannot reject: status is ${approval.status}` };
      }
      approval.status = "rejected";
      approval.resolvedBy = rejectedBy;
      approval.resolvedAt = new Date().toISOString();
      pruneResolved();
      return { success: true, approval };
    },

    getPending() {
      expireTimedOut();
      return [...approvals.values()].filter((a) => a.status === "pending");
    },

    getAll() {
      expireTimedOut();
      return [...approvals.values()];
    },

    isApprovalRequired(action, requiredActions) {
      return requiredActions.includes(action);
    },
  };
}
