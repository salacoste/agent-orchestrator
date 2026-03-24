/**
 * Message bus tests (Story 46a.3).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createMessageBus, type BusMessage } from "../message-bus.js";

let tempDir: string;
let jsonlPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "msgbus-test-"));
  jsonlPath = join(tempDir, "messages.jsonl");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("createMessageBus", () => {
  it("delivers published messages to subscribers", async () => {
    const bus = createMessageBus();
    const received: BusMessage[] = [];

    bus.subscribe("test-channel", (msg) => received.push(msg));

    await bus.publish("test-channel", {
      type: "greeting",
      payload: { text: "hello" },
      sender: "agent-1",
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("greeting");
    expect(received[0].payload.text).toBe("hello");
    expect(received[0].sender).toBe("agent-1");
    expect(received[0].channel).toBe("test-channel");
    expect(received[0].id).toBeTruthy();

    await bus.close();
  });

  it("isolates messages by channel", async () => {
    const bus = createMessageBus();
    const channelA: BusMessage[] = [];
    const channelB: BusMessage[] = [];

    bus.subscribe("channel-a", (msg) => channelA.push(msg));
    bus.subscribe("channel-b", (msg) => channelB.push(msg));

    await bus.publish("channel-a", { type: "a", payload: {}, sender: "s" });
    await bus.publish("channel-b", { type: "b", payload: {}, sender: "s" });

    expect(channelA).toHaveLength(1);
    expect(channelA[0].type).toBe("a");
    expect(channelB).toHaveLength(1);
    expect(channelB[0].type).toBe("b");

    await bus.close();
  });

  it("delivers to multiple subscribers on same channel", async () => {
    const bus = createMessageBus();
    const sub1: BusMessage[] = [];
    const sub2: BusMessage[] = [];

    bus.subscribe("shared", (msg) => sub1.push(msg));
    bus.subscribe("shared", (msg) => sub2.push(msg));

    await bus.publish("shared", { type: "broadcast", payload: {}, sender: "s" });

    expect(sub1).toHaveLength(1);
    expect(sub2).toHaveLength(1);

    await bus.close();
  });

  it("unsubscribe stops delivery", async () => {
    const bus = createMessageBus();
    const received: BusMessage[] = [];

    const unsub = bus.subscribe("ch", (msg) => received.push(msg));

    await bus.publish("ch", { type: "before", payload: {}, sender: "s" });
    expect(received).toHaveLength(1);

    unsub();

    await bus.publish("ch", { type: "after", payload: {}, sender: "s" });
    expect(received).toHaveLength(1); // Still 1 — unsubscribed

    await bus.close();
  });

  it("does not deliver after close", async () => {
    const bus = createMessageBus();
    const received: BusMessage[] = [];

    bus.subscribe("ch", (msg) => received.push(msg));
    await bus.close();

    await bus.publish("ch", { type: "post-close", payload: {}, sender: "s" });
    expect(received).toHaveLength(0);
  });

  it("survives subscriber errors", async () => {
    const bus = createMessageBus();
    const received: BusMessage[] = [];

    bus.subscribe("ch", () => {
      throw new Error("subscriber crash");
    });
    bus.subscribe("ch", (msg) => received.push(msg));

    await bus.publish("ch", { type: "test", payload: {}, sender: "s" });

    // Second subscriber should still receive despite first throwing
    expect(received).toHaveLength(1);

    await bus.close();
  });

  it("does not deliver to unsubscribed channel", async () => {
    const bus = createMessageBus();
    const received: BusMessage[] = [];

    bus.subscribe("other", (msg) => received.push(msg));

    await bus.publish("target", { type: "msg", payload: {}, sender: "s" });

    expect(received).toHaveLength(0);

    await bus.close();
  });
});

describe("JSONL persistence", () => {
  it("persists messages to JSONL file", async () => {
    const bus = createMessageBus(jsonlPath);

    await bus.publish("ch", { type: "persisted", payload: { n: 1 }, sender: "agent-1" });
    await bus.publish("ch", { type: "persisted", payload: { n: 2 }, sender: "agent-2" });

    const content = await readFile(jsonlPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]) as BusMessage;
    expect(first.type).toBe("persisted");
    expect(first.payload.n).toBe(1);

    await bus.close();
  });

  it("replays messages to current subscribers", async () => {
    // Phase 1: Publish messages
    const bus1 = createMessageBus(jsonlPath);
    await bus1.publish("ch", { type: "msg1", payload: {}, sender: "s" });
    await bus1.publish("ch", { type: "msg2", payload: {}, sender: "s" });
    await bus1.close();

    // Phase 2: New bus instance, subscribe, then replay
    const bus2 = createMessageBus(jsonlPath);
    const replayed: BusMessage[] = [];
    bus2.subscribe("ch", (msg) => replayed.push(msg));

    const count = await bus2.replay();

    expect(count).toBe(2);
    expect(replayed).toHaveLength(2);
    expect(replayed[0].type).toBe("msg1");
    expect(replayed[1].type).toBe("msg2");

    await bus2.close();
  });

  it("replays with since filter", async () => {
    const bus1 = createMessageBus(jsonlPath);
    await bus1.publish("ch", { type: "old", payload: {}, sender: "s" });
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    const now = new Date().toISOString();
    await bus1.publish("ch", { type: "new", payload: {}, sender: "s" });
    await bus1.close();

    const bus2 = createMessageBus(jsonlPath);
    const replayed: BusMessage[] = [];
    bus2.subscribe("ch", (msg) => replayed.push(msg));

    const count = await bus2.replay(now);

    expect(count).toBe(1);
    expect(replayed[0].type).toBe("new");

    await bus2.close();
  });

  it("replay returns 0 for nonexistent file", async () => {
    const bus = createMessageBus(join(tempDir, "nonexistent.jsonl"));
    const count = await bus.replay();
    expect(count).toBe(0);
    await bus.close();
  });

  it("replay respects channel isolation", async () => {
    const bus1 = createMessageBus(jsonlPath);
    await bus1.publish("ch-a", { type: "a", payload: {}, sender: "s" });
    await bus1.publish("ch-b", { type: "b", payload: {}, sender: "s" });
    await bus1.close();

    const bus2 = createMessageBus(jsonlPath);
    const received: BusMessage[] = [];
    bus2.subscribe("ch-a", (msg) => received.push(msg));
    // Only subscribed to ch-a

    await bus2.replay();

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("a");

    await bus2.close();
  });
});
