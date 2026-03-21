# @composio/ao-sdk

TypeScript SDK for [Agent Orchestrator](https://github.com/salacoste/agent-orchestrator) — spawn AI coding agents, subscribe to events, get workflow recommendations.

## Install

```bash
npm install @composio/ao-sdk
# or
pnpm add @composio/ao-sdk
```

## Quickstart

```typescript
import { createOrchestrator } from "@composio/ao-sdk";

const ao = createOrchestrator({
  baseUrl: "http://localhost:5000",
  apiKey: "your-api-key", // optional
});

// Spawn an agent for a story
const { sessionId } = await ao.spawn({ storyId: "1-3-auth-module" });

// Get workflow recommendation
const rec = await ao.recommend("my-project");
console.log(rec?.observation); // "PRD present. Architecture spec not found"

// List active sessions
const sessions = await ao.listSessions();
console.log(`${sessions.length} agents running`);

// Kill a stuck agent
await ao.kill(sessionId);

// Clean up
ao.disconnect();
```

## API Reference

### `createOrchestrator(config)`

Creates an SDK client connected to an Agent Orchestrator instance.

```typescript
const ao = createOrchestrator({
  baseUrl: "http://localhost:5000", // Required
  apiKey: "sk-...",                 // Optional: auth header
  timeoutMs: 30000,                // Optional: request timeout (default: 30s)
});
```

### `ao.spawn(config)`

Spawn a new agent session for a story.

```typescript
const { sessionId } = await ao.spawn({
  storyId: "1-3-auth-module",
  agentProfile: "careful", // Optional: "careful" | "speed" | "security"
  prompt: "Focus on test coverage", // Optional: additional instructions
});
```

### `ao.kill(sessionId)`

Terminate an agent session and return its story to the queue.

```typescript
await ao.kill("ao-session-abc123");
```

### `ao.recommend(projectId)`

Get the current workflow recommendation for a project.

```typescript
const rec = await ao.recommend("my-project");
if (rec) {
  console.log(`Phase: ${rec.phase}`);
  console.log(`Observation: ${rec.observation}`);
  console.log(`Action: ${rec.implication}`);
  console.log(`Reasoning: ${rec.reasoning}`);
}
```

### `ao.onEvent(eventType, handler)`

Subscribe to orchestrator events. Returns an unsubscribe function.

```typescript
const unsub = ao.onEvent("story.completed", (event) => {
  console.log("Story done:", event.data);
});

// Later: stop listening
unsub();
```

**Event types:** `story.completed`, `story.blocked`, `story.started`, `agent.blocked`, `agent.resumed`, `workflow.phase`, `workflow.artifact`

### `ao.listSessions()`

Get all active agent sessions.

```typescript
const sessions = await ao.listSessions();
for (const s of sessions) {
  console.log(`${s.id}: ${s.status} (${s.storyId ?? "no story"})`);
}
```

### `ao.disconnect()`

Clean up connections and resources.

## Examples

### Slack Bot

```typescript
import { createOrchestrator } from "@composio/ao-sdk";

const ao = createOrchestrator({ baseUrl: process.env.AO_URL! });

// Post to Slack when a story completes
ao.onEvent("story.completed", (event) => {
  slack.postMessage({
    channel: "#dev",
    text: `✅ Story ${event.data.storyId} completed by ${event.data.agentId}`,
  });
});
```

### GitHub Action

```yaml
# .github/workflows/orchestrate.yml
- name: Spawn agent for new story
  uses: composio/agent-orchestrator-action@v1
  with:
    command: spawn
    story-id: ${{ github.event.issue.number }}
    ao-url: ${{ secrets.AO_URL }}
```

### CLI Script

```typescript
#!/usr/bin/env tsx
import { createOrchestrator } from "@composio/ao-sdk";

const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
const rec = await ao.recommend(process.argv[2] ?? "default");

if (rec) {
  console.log(`Next step for ${rec.phase}: ${rec.implication}`);
} else {
  console.log("All workflow phases complete!");
}

ao.disconnect();
```

## License

MIT
