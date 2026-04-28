---
title: Redis EventBus
nav_order: 9
parent: Plugins
description: Redis-backed EventBus plugin — pub/sub messaging via ioredis with degraded mode, local queue with FIFO eviction, exponential retry strategy, and lazy-loaded Redis client.
---

# Redis EventBus

The **redis-event-bus** plugin provides Redis-backed publish/subscribe messaging for the Agent Orchestrator event system. It uses a separate publisher and subscriber Redis connection, lazy-loads the `ioredis` package on first use, and implements a degraded mode with local queuing when Redis is unavailable.

{: .highlight }
> **Planned slot:** EventBus is designated as Plugin Slot 9 (planned). The `PluginSlot` type does not yet include `"event-bus"`. This plugin is available for use but the slot type integration is pending.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `redis-event-bus` |
| **Slot** | `event-bus` |
| **Package** | `@composio/ao-plugin-event-bus-redis` |
| **Version** | `0.1.0` |
| **Default** | No |

---

## How It Works

The redis-event-bus plugin manages two Redis connections for pub/sub and falls back to local queuing when Redis is unavailable:

```text
create(config) -- config is REQUIRED
  |
  +-- Merge config with defaults
  +-- Set retry strategy from retryDelays array

publish(event)
  |
  +-- Enrich: add eventId (UUID) + timestamp
  +-- initRedis() -- lazy load ioredis
  |     +-- Fail: degrade + queue locally
  |
  +-- Connected?
  |     +-- yes: JSON.stringify + publish
  |     |         +-- Fail: queue locally
  |     +-- no: queue locally (silent)
  |
  +-- Done

subscribe(callback)
  |
  +-- Register callback in local Map
  +-- initRedis() -- lazy load ioredis
  |     +-- Fail: warn (sub still registered)
  |
  +-- On message: JSON.parse -> callback
  +-- Return unsubscribe function
```

---

## Transport

- Uses `ioredis` package for Redis connections (lazy-loaded via dynamic `import()`)
- **Two Redis clients**: publisher (for `redis.publish()`) and subscriber (via `redis.duplicate()`)
- **Default channel**: `"ao:events"` — configurable via `config.channel`
- **Serialization**: Events are `JSON.stringify`'d for publish, `JSON.parse`'d on receive
- **Lazy initialization**: Redis is initialized on first `publish()` or `subscribe()` call
- **Connection state tracking**: `isConnected` and `isDegraded` booleans updated by Redis event handlers

---

## Degraded Mode

When Redis is unavailable, the plugin enters degraded mode:

1. **Local queue**: Events are queued in an in-memory `eventQueue` array
2. **Queue overflow**: When queue exceeds `queueMaxSize` (default 1000), oldest events are dropped (FIFO eviction via `shift()`)
3. **Drain on ready**: When Redis fires the `"ready"` event (initial connection or reconnect), `drainQueue()` publishes all queued events sequentially
4. **Drain failure**: If publishing a queued event fails, the event is re-inserted at the front (`unshift()`) so it is retried first

```text
Redis DOWN:
  publish -> queue event locally
  queue full -> drop oldest (shift) -> push new

Redis UP:
  drainQueue -> publish queued events
  publish fail -> unshift back to front -> break loop
```

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"redis-event-bus"` |

### Required Methods (6)

#### publish(event)

Publishes an event to the Redis channel:

- **Event enrichment**: Adds `eventId` (UUID via `randomUUID()`) and `timestamp` (ISO string)
- Input is `Omit<EventBusEvent, "eventId" | "timestamp">` — eventId and timestamp are auto-generated
- **Init failure**: Sets `isDegraded = true`, queues event locally, logs warning — does NOT throw
- **Not connected** (init succeeded but `state.isConnected` is false): Queues event locally without logging — does NOT throw
- **Publish failure**: Queues event locally, logs error — does NOT throw

#### subscribe(callback)

Subscribes to events from the Redis channel:

- Returns a `Promise` that resolves to an unsubscribe function: `() => void`
- Each subscription gets a unique `subscriptionId` (UUID) stored in a `Map<string, Set<EventSubscriber>>`
- **Callback errors**: Each callback wrapped in individual try/catch — errors logged, not propagated
- **JSON parse errors**: Wrapped in try/catch — logged, not propagated
- **Init failure**: Logs warning — subscription still registered in local Map

#### isConnected()

Returns `boolean` — whether the Redis connection is active.

#### isDegraded()

Returns `boolean` — whether the plugin is in degraded mode (Redis unavailable, using local queue).

#### getQueueSize()

Returns `number` — the number of events currently in the local queue.

#### close()

Closes the Redis connections:

- Closes redis clients first, sets internal reference to `null`
- Calls `drainQueue()` — **note**: this is non-functional after `redis = null` because `drainQueue()` immediately returns when `!redis`; any queued events are effectively abandoned
- Then unsubscribes and clears subscribers
- Note: `isDegraded` remains as set by the close event

### Optional Methods (1)

#### ping()

Measures Redis round-trip time:

- Uses `redis.config("GET", "timeout")` — a lightweight command that requires server response
- Returns round-trip time in milliseconds
- On failure, returns `undefined`

---

## EventBusEvent Type

All events published through the bus follow this structure:

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "ci.failing",
  "timestamp": "2026-04-24T10:30:00.000Z",
  "metadata": {
    "sessionId": "sess-abc",
    "projectId": "my-app"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `eventId` | `string` | Auto-generated UUID |
| `eventType` | `string` | Event type identifier |
| `timestamp` | `string` | Auto-generated ISO 8601 timestamp |
| `metadata` | `Record<string, unknown>` | Arbitrary event data |

---

## Configuration

### Basic Setup

```yaml
eventBus:
  plugin: redis-event-bus
  host: localhost
  port: 6379
```

### With Authentication and Custom Channel

```yaml
eventBus:
  plugin: redis-event-bus
  host: redis.example.com
  port: 6379
  password: "your-redis-password"
  channel: "ao:production:events"
```

### With Retry and Queue Tuning

```yaml
eventBus:
  plugin: redis-event-bus
  host: localhost
  port: 6379
  retryDelays: [1000, 2000, 5000, 10000, 30000]
  queueMaxSize: 5000
  enableAOF: true
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `host` | string | Yes | — | Redis server hostname |
| `port` | number | Yes | — | Redis server port |
| `db` | number | No | `0` | Redis database number |
| `password` | string | No | — | Redis authentication password |
| `channel` | string | No | `"ao:events"` | Pub/sub channel name |
| `retryDelays` | number[] | No | `[1000, 2000, 4000, 8000, 16000]` | Retry delay sequence in ms (capped at last value). `maxRetriesPerRequest` is hardcoded to `3` |
| `queueMaxSize` | number | No | `1000` | Maximum local queue size (FIFO eviction) |
| `enableAOF` | boolean | No | — | Enable Redis AOF persistence |

{: .highlight }
> **Config is required:** Unlike other plugins, `create(config)` requires an `EventBusConfig` object. Missing `ioredis` package throws: `"ioredis package not found. Install it with: pnpm add ioredis"`.

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Multi-process orchestration | Use redis-event-bus — cross-process pub/sub |
| Production deployment | Use redis-event-bus — persistent messaging |
| Single-process development | Default (no event bus) — in-process events sufficient |
| Need event durability | Use redis-event-bus — local queue survives brief outages |
| High event throughput | Use redis-event-bus — Redis handles 100K+ messages/sec |
| Zero infrastructure | Skip event bus — no Redis needed for single-process |

---

## Next Steps

- [Terminal Plugins](../terminals/) — Terminal tab management plugins
- [Provider Plugins](../providers/) — Session enhancement plugins
- [Plugins](../) — Plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
