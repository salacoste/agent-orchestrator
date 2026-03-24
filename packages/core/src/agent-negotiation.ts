/**
 * Agent negotiation — direct conflict resolution protocol (Story 47.1).
 *
 * Defines message types and handler logic for agents to negotiate
 * file conflicts without human escalation. Uses message bus (46a.3).
 */

/** Negotiation outcome. */
export type NegotiationOutcome = "agreed" | "rejected" | "timeout" | "escalated";

/** Negotiation request message payload. */
export interface NegotiationRequest {
  requesterId: string;
  targetId: string;
  conflictFiles: string[];
  timeoutMs: number;
  requestedAt: string;
}

/** Negotiation response message payload. */
export interface NegotiationResponse {
  requesterId: string;
  targetId: string;
  accepted: boolean;
  adjustedFiles: string[];
  escalate: boolean;
  respondedAt: string;
}

/** Full negotiation record. */
export interface NegotiationRecord {
  id: string;
  request: NegotiationRequest;
  response: NegotiationResponse | null;
  outcome: NegotiationOutcome;
  resolvedAt: string;
}

/** Default negotiation timeout (2 minutes). */
export const DEFAULT_TIMEOUT_MS = 120_000;

/** Negotiation channel name for message bus. */
export const NEGOTIATION_CHANNEL = "agent.negotiation";

/**
 * Create a negotiation request payload.
 */
export function createNegotiationRequest(
  requesterId: string,
  targetId: string,
  conflictFiles: string[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): NegotiationRequest {
  return {
    requesterId,
    targetId,
    conflictFiles,
    timeoutMs,
    requestedAt: new Date().toISOString(),
  };
}

/**
 * Evaluate a negotiation request and produce a response.
 *
 * Decision logic: if any conflict files can be avoided (not in agent's
 * required files), accept with adjusted list. Otherwise reject.
 */
export function evaluateNegotiation(
  request: NegotiationRequest,
  agentRequiredFiles: string[],
): NegotiationResponse {
  const required = new Set(agentRequiredFiles);
  const canAvoid = request.conflictFiles.filter((f) => !required.has(f));
  const mustTouch = request.conflictFiles.filter((f) => required.has(f));

  const accepted = mustTouch.length === 0;
  const escalate = !accepted && canAvoid.length === 0;

  return {
    requesterId: request.requesterId,
    targetId: request.targetId,
    accepted,
    adjustedFiles: canAvoid,
    escalate,
    respondedAt: new Date().toISOString(),
  };
}

/**
 * Determine negotiation outcome from a response (or lack thereof).
 */
export function resolveOutcome(
  response: NegotiationResponse | null,
  timedOut: boolean,
): NegotiationOutcome {
  if (timedOut) return "timeout";
  if (!response) return "timeout";
  if (response.escalate) return "escalated";
  return response.accepted ? "agreed" : "rejected";
}
