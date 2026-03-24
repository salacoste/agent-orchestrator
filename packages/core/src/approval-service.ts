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
export function createApprovalService(): ApprovalService {
  const approvals = new Map<string, ApprovalRequest>();

  /** Check and expire timed-out approvals. */
  function expireTimedOut(): void {
    const now = Date.now();
    for (const approval of approvals.values()) {
      if (
        approval.status === "pending" &&
        approval.timeoutMs &&
        now - new Date(approval.requestedAt).getTime() >= approval.timeoutMs
      ) {
        approval.status = "expired";
      }
    }
  }

  return {
    requestApproval(action, target, requestedBy, timeoutMs) {
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
      const approval = approvals.get(id);
      if (!approval) {
        return {
          success: false,
          approval: {
            id,
            action: "",
            target: "",
            requestedBy: "",
            requestedAt: "",
            status: "pending" as const,
          },
          error: "Approval not found",
        };
      }
      if (approval.status !== "pending") {
        return { success: false, approval, error: `Cannot approve: status is ${approval.status}` };
      }
      approval.status = "approved";
      approval.resolvedBy = approvedBy;
      approval.resolvedAt = new Date().toISOString();
      return { success: true, approval };
    },

    reject(id, rejectedBy) {
      const approval = approvals.get(id);
      if (!approval) {
        return {
          success: false,
          approval: {
            id,
            action: "",
            target: "",
            requestedBy: "",
            requestedAt: "",
            status: "pending" as const,
          },
          error: "Approval not found",
        };
      }
      if (approval.status !== "pending") {
        return { success: false, approval, error: `Cannot reject: status is ${approval.status}` };
      }
      approval.status = "rejected";
      approval.resolvedBy = rejectedBy;
      approval.resolvedAt = new Date().toISOString();
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
