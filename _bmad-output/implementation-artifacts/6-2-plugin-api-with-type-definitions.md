# Story 6.2: Plugin API with Type Definitions

Status: ready-for-dev

## Story

As a Plugin Developer,
I want comprehensive TypeScript type definitions and API documentation,
so that I can develop plugins with compile-time validation and IntelliSense.

## Acceptance Criteria

1. **Given** I install the SDK
   - Import types from @composio/ao-plugin-api
   - All types available for compile-time checking (NFR-I3)
   - IntelliSense for all API methods

2. **Given** I create a plugin
   - Export manifest: PluginManifest
   - Export create(context: PluginContext): Plugin
   - TypeScript validates export matches Plugin interface

3. **Given** I handle events
   - Event type provides: id, type, timestamp, data
   - TypeScript narrows event data by event type
   - Access story-specific fields for "story.completed"

4. **Given** PluginContext provided
   - logger: Logger
   - config: Config
   - events: EventEmitter
   - state: StateManager
   - agents: AgentManager

5. **Given** I access API docs
   - JSDoc comments in types (hover in IDE)
   - /docs/plugins.md
   - Online API reference
   - Migration guides

## Tasks / Subtasks

- [ ] Create @composio/ao-plugin-api package
  - [ ] Export all types: Plugin, PluginContext, Story, Agent, Event, Trigger, EventHandler
  - [ ] JSDoc comments on all interfaces
  - [ ] Usage examples in docs
- [ ] Publish to npm
- [ ] Write unit tests

## Dev Notes

### Type Definitions

```typescript
// @composio/ao-plugin-api
export interface Plugin {
  name: string;
  version: string;
  init(): Promise<void>;
  onEvent?(event: Event): Promise<void>;
  shutdown(): Promise<void>;
}

export interface PluginContext {
  logger: Logger;
  config: Config;
  events: EventEmitter;
  state: StateManager;
  agents: AgentManager;
}
```

## Dependencies

- Story 6.1 (Plugin System Core) - Plugin loading

## Dev Agent Record

_(To be filled by Dev Agent)_
