/**
 * Shared approval service singleton (Story 46b.2).
 * Separate file because Next.js route files cannot export non-route values.
 */
import { createApprovalService } from "@composio/ao-core";

export const approvalService = createApprovalService();
