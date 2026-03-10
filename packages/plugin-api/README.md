# @composio/ao-plugin-api

Plugin API type definitions and interfaces for Agent Orchestrator.

## Installation

```bash
npm install @composio/ao-plugin-api
```

## Overview

### Type System Architecture

Agent Orchestrator has two separate type systems for plugins:

1. **`@composio/ao-plugin-api`** (this package) - For **plugin developers**
   - Provides `Plugin` interface for runtime plugin implementation
   - Provides `PluginContext` interface for accessing orchestrator services
   - Used as a `devDependency` when creating plugins
   - Enables compile-time validation of plugin code

2. **`@composio/ao-core`** - For **internal orchestrator development**
   - Provides `PluginManifest` interface for `plugin.yaml` structure
   - Provides `PluginModule` interface for loading internal plugins
   - Used by the orchestrator's plugin loader
   - Defines the 8 plugin slots (runtime, agent, workspace, tracker, scm, notifier, terminal, lifecycle)

### When to Use Each

```typescript
// ✅ Plugin developers: Use @composio/ao-plugin-api
import type { Plugin, PluginContext } from '@composio/ao-plugin-api';

export function create(context: PluginContext): Plugin {
  return {
    name: 'my-plugin',
    version: '1.0.0',
    init: async () => {},
    shutdown: async () => {},
  };
}

// ✅ Internal development: Use @composio/ao-core
import type { PluginManifest, PluginModule } from '@composio/ao-core';

const manifest: PluginManifest = {
  name: 'tmux',
  slot: 'runtime',
  description: 'tmux runtime plugin',
  version: '1.0.0',
};
```

### How They Work Together

1. Plugin developers implement the `Plugin` interface from `@composio/ao-plugin-api`
2. Plugin package includes a `plugin.yaml` file (validated against `PluginManifest` schema)
3. Orchestrator's plugin loader reads `plugin.yaml` and loads the plugin module
4. At runtime, the plugin receives a `PluginContext` and executes

**Key point:** The two type systems serve different purposes:
- `Plugin` (plugin-api) = What your plugin code does at runtime
- `PluginManifest` (core) = How your plugin is registered and loaded

## Usage

### Creating a Plugin

All plugins must implement the `Plugin` interface:

```typescript
import type { Plugin, PluginContext } from '@composio/ao-plugin-api';

export function create(context: PluginContext): Plugin {
  return {
    name: 'my-plugin',
    version: '1.0.0',

    async init() {
      context.logger.info('Plugin initialized');
    },

    async onEvent(event) {
      if (event.type === 'story.completed') {
        context.logger.info(`Story completed: ${event.data.storyId}`);
      }
    },

    async shutdown() {
      context.logger.info('Plugin shutting down');
    },
  };
}
```

### Plugin Manifest

Your plugin must also include a `plugin.yaml` file:

```yaml
name: "my-plugin"
version: "1.0.0"
description: "My custom plugin"
apiVersion: "1.0.0"
main: "./index.js"
permissions:
  - runtime
  - tracker
```

### Event Handling

Subscribe to events using the `onEvent` handler:

```typescript
async onEvent(event) {
  switch (event.type) {
    case 'story.completed':
      const data = event.data as { storyId: string; status: string };
      context.logger.info(`Story ${data.storyId} is ${data.status}`);
      break;

    case 'agent.started':
      context.logger.info('Agent started:', event.data);
      break;

    case 'agent.blocked':
      // Handle blocked agents
      context.events.emit('agent.intervention', {
        agentId: event.data.agentId,
        reason: 'Blocked, needs help',
      });
      break;
  }
}
```

### Accessing Plugin Context

The `PluginContext` provides access to orchestrator services:

```typescript
export function create(context: PluginContext): Plugin {
  // Logging
  context.logger.info('Info message');
  context.logger.error('Error message');
  context.logger.warn('Warning message');
  context.logger.debug('Debug message');

  // Configuration
  const timeout = context.config.get('plugin.timeout');
  context.config.set('plugin.lastRun', new Date().toISOString());

  // Events
  const unsubscribe = context.events.on('custom.event', (data) => {
    console.log('Received:', data);
  });
  context.events.emit('custom.event', { foo: 'bar' });

  // State
  const storyStatus = context.state.get('stories.story-1.status');
  context.state.set('stories.story-1.status', 'done');

  // Agents
  const agents = context.agents.list();
  const agent = context.agents.get('agent-1');

  return { /* ... */ };
}
```

## Type Definitions

### Plugin

```typescript
interface Plugin {
  name: string;
  version: string;
  init(): Promise<void>;
  onEvent?(event: Event): Promise<void>;
  shutdown(): Promise<void>;
}
```

### PluginContext

```typescript
interface PluginContext {
  logger: Logger;
  config: Config;
  events: EventEmitter;
  state: StateManager;
  agents: AgentManager;
}
```

### Event

```typescript
interface Event {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}
```

### Story

```typescript
interface Story {
  id: string;
  title: string;
  description: string;
  status: StoryStatus;
  acceptanceCriteria: string[];
  tasks: StoryTask[];
}
```

### Agent

```typescript
interface Agent {
  id: string;
  storyId: string;
  status: AgentStatus;
  startTime: string;
  endTime?: string;
  error?: string;
}
```

### Trigger

```typescript
interface Trigger {
  id: string;
  type: TriggerType;
  condition: TriggerCondition;
  action: TriggerAction;
  enabled?: boolean;
}
```

## Event Types

Common event types:

- `story.completed` - A story was completed
- `story.started` - A story was started
- `agent.started` - An agent was spawned
- `agent.completed` - An agent finished work
- `agent.blocked` - An agent is blocked
- `agent.resumed` - A blocked agent was resumed

## License

MIT
