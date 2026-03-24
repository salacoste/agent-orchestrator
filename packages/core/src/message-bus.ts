/**
 * Inter-agent messaging bus — channel-based pub/sub (Story 46a.3).
 *
 * In-memory message delivery with JSONL persistence for replay.
 * Named channels isolate message streams.
 */

import { randomUUID } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

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

  /** Deliver a message to all subscribers of its channel. */
  function deliver(message: BusMessage): void {
    const channelSubs = subscribers.get(message.channel);
    if (!channelSubs) return;
    for (const cb of [...channelSubs]) {
      try {
        cb(message);
      } catch {
        // Subscriber error — don't break other deliveries
      }
    }
  }

  return {
    async publish(channel, input) {
      if (closed) return;

      const message: BusMessage = {
        id: randomUUID(),
        channel,
        type: input.type,
        payload: input.payload,
        timestamp: new Date().toISOString(),
        sender: input.sender,
      };

      // Persist to JSONL before delivery (at-least-once guarantee)
      if (jsonlPath) {
        await appendFile(jsonlPath, JSON.stringify(message) + "\n", "utf-8");
      }

      // Deliver to subscribers
      deliver(message);
    },

    subscribe(channel, callback) {
      if (!subscribers.has(channel)) {
        subscribers.set(channel, new Set());
      }
      subscribers.get(channel)!.add(callback);

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
      if (!jsonlPath || !existsSync(jsonlPath)) return 0;

      const content = await readFile(jsonlPath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      const sinceMs = since ? new Date(since).getTime() : 0;
      let count = 0;

      for (const line of lines) {
        try {
          const message = JSON.parse(line) as BusMessage;
          if (new Date(message.timestamp).getTime() >= sinceMs) {
            deliver(message);
            count++;
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
