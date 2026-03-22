/**
 * Handoff protocol (Story 42.3).
 *
 * Packages agent states, pending decisions, and collaboration context
 * into a serializable bundle for team handoffs.
 */
import {
  getDecisionLog,
  getAllClaims,
  getAllAnnotations,
  getAllOwners,
  type Decision,
  type ReviewClaim,
  type Annotation,
  type AgentOwner,
} from "./collaboration";

/** A complete handoff bundle containing all collaboration state. */
export interface HandoffBundle {
  /** Who created this handoff. */
  sender: string;
  /** Intended recipient. */
  recipient: string;
  /** When the handoff was created. */
  createdAt: string;
  /** Optional context message from sender. */
  message?: string;
  /** Snapshot of the decision log. */
  decisions: Decision[];
  /** Snapshot of active review claims. */
  claims: ReviewClaim[];
  /** Snapshot of artifact annotations. */
  annotations: Annotation[];
  /** Snapshot of agent ownership assignments. */
  owners: AgentOwner[];
}

/**
 * Create a handoff bundle capturing current collaboration state.
 *
 * @param sender — who is handing off
 * @param recipient — who is receiving
 * @param message — optional context/instructions
 */
export function createHandoff(
  sender: string,
  recipient: string,
  message?: string,
): HandoffBundle | null {
  const trimmedSender = sender.trim();
  const trimmedRecipient = recipient.trim();
  if (!trimmedSender || !trimmedRecipient) return null;

  return {
    sender: trimmedSender,
    recipient: trimmedRecipient,
    createdAt: new Date().toISOString(),
    message,
    decisions: [...getDecisionLog()],
    claims: getAllClaims(),
    annotations: [...getAllAnnotations()],
    owners: getAllOwners(),
  };
}

/**
 * Serialize a handoff bundle to JSON string.
 */
export function serializeHandoff(bundle: HandoffBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Deserialize a handoff bundle from JSON string.
 * Returns null if the JSON is invalid or missing required fields.
 */
export function deserializeHandoff(json: string): HandoffBundle | null {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (
      typeof parsed.sender !== "string" ||
      typeof parsed.recipient !== "string" ||
      typeof parsed.createdAt !== "string" ||
      !Array.isArray(parsed.decisions) ||
      !Array.isArray(parsed.claims) ||
      !Array.isArray(parsed.annotations) ||
      !Array.isArray(parsed.owners)
    ) {
      return null;
    }
    return parsed as unknown as HandoffBundle;
  } catch {
    return null;
  }
}
