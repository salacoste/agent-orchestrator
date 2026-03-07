# Story 6.6: Community Plugin Registry

Status: ready-for-dev

## Story

As a Developer,
I want to discover and share plugins through a community registry,
so that I can benefit from community contributions and contribute back.

## Acceptance Criteria

1. **Given** I run `ao plugin registry`
   - Opens registry in browser or CLI view
   - Display plugins: name, description, downloads
   - Search and filter available

2. **Given** I want to install from registry
   - Click install button in registry
   - Runs `ao plugin install <package>`
   - Plugin installed and activated

3. **Given** I want to submit a plugin
   - CLI command: `ao plugin publish ./my-plugin`
   - Validate plugin structure
   - Upload to registry
   - Package published and visible to others

4. **Given** I want to search for plugins
   - `ao plugin search <query>`
   - Search by name, description, tags
   - Display results with relevance score

## Tasks / Subtasks

- [ ] Implement registry API client
  - [ ] Query registry for plugins
  - [ ] Get plugin details
  - [ ] Download plugin package
- [ ] Implement registry web UI
  - [ ] Browse available plugins
  - [ - Search and filter
  - [ - Install button
- [ ] Implement CLI command `ao plugin registry`
  - [ ] Display registry in CLI or browser
  - [ ] Interactive browse mode
  - [ ] Search functionality
- [ ] Implement plugin submission
  - [ ] CLI: `ao plugin publish ./my-plugin`
  - [ ] Validate plugin structure
  - [ ] Upload to registry
  - [ - Package with metadata and README
- [ ] Write unit tests

## Dev Notes

### Registry Interface

```typescript
interface PluginRegistry {
  search(query: string): Promise<PluginSearchResult[]>;
  getDetails(packageName: string): Promise<PluginDetails>;
  download(packageName: string): Promise<string>; // Returns path
  publish(pluginPath: string): Promise<void>;
}
```

### Registry Output

```
Agent Orchestrator Plugin Registry
==================================

Search: slack ↓

Plugin                              | Description              | Downloads | Rating
------------------------------------|----------------------------|-----------|--------
@composio/ao-plugin-slack        | Slack notifications      | 1,234     | ⭐⭐⭐⭐⭐
@org/slack-workflow-automation | Slack workflows             | 567       | ⭐⭐⭐⭐
```

### CLI Commands

```bash
ao plugin registry
ao plugin publish ./my-plugin
```

### Dependencies

- Story 6.1 (Plugin System) - Plugin loading
- Story 6.5 (Plugin Installation) - Install integration

## Dev Agent Record

_(To be filled by Dev Agent)_
