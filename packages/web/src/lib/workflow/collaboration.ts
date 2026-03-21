/**
 * Multi-user collaboration module (Stories 27.1, 27.2, 27.3).
 *
 * Team presence, review claims, and decision logging.
 * Pure module — works with provided data.
 */

// ---------------------------------------------------------------------------
// Story 27.1: Team Presence
// ---------------------------------------------------------------------------

/** A user's presence on a dashboard page. */
export interface UserPresence {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  currentPage: string;
  lastSeenAt: string;
}

/** Track who's viewing what. */
const presenceMap = new Map<string, UserPresence>();

export function updatePresence(presence: UserPresence): void {
  presenceMap.set(presence.userId, presence);
}

export function getPresenceForPage(page: string): UserPresence[] {
  return [...presenceMap.values()].filter((p) => p.currentPage === page);
}

export function removePresence(userId: string): void {
  presenceMap.delete(userId);
}

export function getAllPresence(): UserPresence[] {
  return [...presenceMap.values()];
}

// ---------------------------------------------------------------------------
// Story 27.2: Review Claim System
// ---------------------------------------------------------------------------

/** A claimed review item. */
export interface ReviewClaim {
  itemId: string;
  claimedBy: string;
  claimedAt: string;
  itemDescription: string;
}

const claims = new Map<string, ReviewClaim>();

export function claimItem(itemId: string, userId: string, description: string): ReviewClaim {
  const claim: ReviewClaim = {
    itemId,
    claimedBy: userId,
    claimedAt: new Date().toISOString(),
    itemDescription: description,
  };
  claims.set(itemId, claim);
  return claim;
}

export function unclaimItem(itemId: string): void {
  claims.delete(itemId);
}

export function getClaimForItem(itemId: string): ReviewClaim | null {
  return claims.get(itemId) ?? null;
}

export function getAllClaims(): ReviewClaim[] {
  return [...claims.values()];
}

export function isItemClaimed(itemId: string): boolean {
  return claims.has(itemId);
}

// ---------------------------------------------------------------------------
// Story 27.3: Decision Log
// ---------------------------------------------------------------------------

/** A logged human decision. */
export interface Decision {
  id: string;
  who: string;
  what: string;
  why: string;
  timestamp: string;
  context?: string;
}

const decisions: Decision[] = [];

export function logDecision(decision: Omit<Decision, "id" | "timestamp">): Decision {
  const entry: Decision = {
    ...decision,
    id: `decision-${decisions.length + 1}`,
    timestamp: new Date().toISOString(),
  };
  decisions.push(entry);
  return entry;
}

export function getDecisionLog(): readonly Decision[] {
  return decisions;
}

export function getRecentDecisions(count: number): Decision[] {
  return decisions.slice(-count);
}

export function _resetCollaboration(): void {
  presenceMap.clear();
  claims.clear();
  decisions.length = 0;
}
