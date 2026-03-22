/**
 * Multi-user collaboration module (Stories 27.1, 27.2, 27.3, 39.1).
 *
 * Team presence, review claims, and decision logging.
 * Story 39.1: Change broadcasting via subscriber callbacks.
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
  notify({
    type: "presence",
    action: "update",
    data: presence,
    timestamp: new Date().toISOString(),
  });
}

export function getPresenceForPage(page: string): UserPresence[] {
  return [...presenceMap.values()].filter((p) => p.currentPage === page);
}

export function removePresence(userId: string): void {
  const removed = presenceMap.get(userId);
  presenceMap.delete(userId);
  if (removed) {
    notify({
      type: "presence",
      action: "remove",
      data: removed,
      timestamp: new Date().toISOString(),
    });
  }
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
  notify({ type: "claim", action: "claim", data: claim, timestamp: claim.claimedAt });
  return claim;
}

export function unclaimItem(itemId: string): void {
  const removed = claims.get(itemId);
  claims.delete(itemId);
  if (removed) {
    notify({
      type: "claim",
      action: "unclaim",
      data: removed,
      timestamp: new Date().toISOString(),
    });
  }
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
  notify({ type: "decision", action: "log", data: entry, timestamp: entry.timestamp });
  return entry;
}

export function getDecisionLog(): readonly Decision[] {
  return decisions;
}

export function getRecentDecisions(count: number): Decision[] {
  return decisions.slice(-count);
}

// ---------------------------------------------------------------------------
// Story 42.1: Shared Annotations
// ---------------------------------------------------------------------------

/** An annotation on an artifact. */
export interface Annotation {
  id: string;
  artifactId: string;
  author: string;
  text: string;
  timestamp: string;
}

const annotations: Annotation[] = [];
let annotationCounter = 0;

/** Maximum annotation text length. */
const MAX_ANNOTATION_LENGTH = 1000;

/** Add an annotation to an artifact. */
export function addAnnotation(annotation: Omit<Annotation, "id" | "timestamp">): Annotation {
  annotationCounter++;
  const text =
    annotation.text.length > MAX_ANNOTATION_LENGTH
      ? annotation.text.slice(0, MAX_ANNOTATION_LENGTH)
      : annotation.text;
  const entry: Annotation = {
    ...annotation,
    text,
    id: `annotation-${Date.now()}-${annotationCounter}`,
    timestamp: new Date().toISOString(),
  };
  annotations.push(entry);
  notify({ type: "annotation", action: "add", data: entry, timestamp: entry.timestamp });
  return entry;
}

/** Get all annotations for a specific artifact. Creates a filtered copy each call.
 * If performance becomes a concern with many annotations, index by artifactId in a Map. */
export function getAnnotations(artifactId: string): Annotation[] {
  return annotations.filter((a) => a.artifactId === artifactId);
}

/** Get all annotations. */
export function getAllAnnotations(): readonly Annotation[] {
  return annotations;
}

// ---------------------------------------------------------------------------
// Story 39.1: Change Broadcasting
// ---------------------------------------------------------------------------

/** A collaboration change event emitted to subscribers (discriminated union). */
export type CollaborationEvent =
  | { type: "presence"; action: "update" | "remove"; data: UserPresence; timestamp: string }
  | { type: "claim"; action: "claim" | "unclaim"; data: ReviewClaim; timestamp: string }
  | { type: "decision"; action: "log"; data: Decision; timestamp: string }
  | { type: "annotation"; action: "add"; data: Annotation; timestamp: string };

export type CollaborationSubscriber = (event: CollaborationEvent) => void;

const subscribers = new Set<CollaborationSubscriber>();

/** Subscribe to collaboration changes. Returns an unsubscribe function. */
export function subscribeCollaborationChanges(cb: CollaborationSubscriber): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** Notify all subscribers of a collaboration change. */
function notify(event: CollaborationEvent): void {
  // Snapshot to avoid issues if a callback modifies the subscriber set
  for (const cb of [...subscribers]) {
    try {
      cb(event);
    } catch {
      // Subscriber errors are non-fatal
    }
  }
}

// ---------------------------------------------------------------------------
// Reset (testing)
// ---------------------------------------------------------------------------

export function _resetCollaboration(): void {
  presenceMap.clear();
  claims.clear();
  decisions.length = 0;
  annotations.length = 0;
  subscribers.clear();
}
