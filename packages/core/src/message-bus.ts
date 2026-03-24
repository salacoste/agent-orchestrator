/**
 * Inter-agent messaging bus — channel-based pub/sub (Story 46a.3).
 *
 * In-memory message delivery with JSONL persistence for replay.
 * Named channels isolate message streams.
 */

import { randomUUID } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";

/** A message on the bus. */
export interface BusMessage {
  id: string;
  channel: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  sender: string;
}

/** Message subscriber callback. */
export type MessageSubscriber = (message: BusMessage) => void;

/** Message bus interface. */
export interface MessageBus {
  /** Publish a message to a named channel. */
  publish(
    channel: string,
    message: { type: string; payload: Record<string, unknown>; sender: string },
  ): Promise<void>;
  /** Subscribe to a channel. Returns unsubscribe function. */
  subscribe(channel: string, callback: MessageSubscriber): () => void;
  /** Replay persisted messages to current subscribers. Returns count replayed. */
  replay(since?: string): Promise<number>;
  /** Close the bus and clean up. */
  close(): Promise<void>;
}

/**
 * Create an in-memory message bus with optional JSONL persistence.
 *
 * @param jsonlPath — Path to messages.jsonl for persistence. Omit for in-memory only.
 */
export function createMessageBus(jsonlPath?: string): MessageBus {
  const subscribers = new Map<string, Set<MessageSubscriber>>();
  let closed = false;

  /** Max consecutive errors before auto-unsubscribing a callback. */
  const MAX_ERRORS = 10;
  const errorCounts = new WeakMap<MessageSubscriber, number>();

  /** Deliver a message to all subscribers of its channel. Returns true if any received. */
  function deliver(message: BusMessage): boolean {
    const channelSubs = subscribers.get(message.channel);
    if (!channelSubs || channelSubs.size === 0) return false;
    for (const cb of [...channelSubs]) {
      try {
        cb(message);
        errorCounts.delete(cb); // Reset on success
      } catch {
        const count = (errorCounts.get(cb) ?? 0) + 1;
        if (count >= MAX_ERRORS) {
          channelSubs.delete(cb); // Auto-unsubscribe after too many errors
          errorCounts.delete(cb);
        } else {
          errorCounts.set(cb, count);
        }
      }
    }
    return true;
  }

  return {
    async publish(channel, input) {
      if (closed) throw new Error("Cannot publish on closed bus");

      const message: BusMessage = {
        id: randomUUID(),
        channel,
        type: input.type,
        payload: input.payload,
        timestamp: new Date().toISOString(),
        sender: input.sender,
      };

      // Persist to JSONL before delivery (at-least-once guarantee)
      // If persistence fails, deliver to subscribers anyway but re-throw
      let persistError: Error | null = null;
      if (jsonlPath) {
        try {
          await appendFile(jsonlPath, JSON.stringify(message) + "\n", "utf-8");
        } catch (err) {
          persistError = err instanceof Error ? err : new Error("Persistence failed");
        }
      }

      // Always deliver to subscribers
      deliver(message);

      // Re-throw persistence error so caller knows it wasn't persisted
      if (persistError) throw persistError;
    },

    subscribe(channel, callback) {
      if (closed) return () => {}; // No-op after close

      if (!subscribers.has(channel)) {
        subscribers.set(channel, new Set());
      }
      const subs = subscribers.get(channel);
      if (subs) subs.add(callback);

      // Return unsubscribe function
      return () => {
        const subs = subscribers.get(channel);
        if (subs) {
          subs.delete(callback);
          if (subs.size === 0) subscribers.delete(channel);
        }
      };
    },

    async replay(since) {
      if (closed) return 0;
      if (!jsonlPath) return 0;

      // Use try/catch instead of existsSync to avoid TOCTOU race
      let content: string;
      try {
        content = await readFile(jsonlPath, "utf-8");
      } catch {
        return 0; // File doesn't exist or unreadable
      }

      const lines = content.trim().split("\n").filter(Boolean);

      // Guard invalid since date — treat as replay-all
      const sinceMs = since ? new Date(since).getTime() : 0;
      const safeSinceMs = isNaN(sinceMs) ? 0 : sinceMs;
      let count = 0;

      for (const line of lines) {
        try {
          const message = JSON.parse(line) as BusMessage;
          if (new Date(message.timestamp).getTime() >= safeSinceMs) {
            if (deliver(message)) count++;
          }
        } catch {
          // Skip malformed lines
        }
      }

      return count;
    },

    async close() {
      closed = true;
      subscribers.clear();
    },
  };
}
