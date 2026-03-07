# Story 6.1: Plugin System Core

Status: ready-for-dev

## Story

As a Developer,
I want the system to load, validate, and manage plugins at startup,
so that I can extend functionality without modifying core code.

## Acceptance Criteria

1. **Given** the system starts
   - Scan plugins directory for installed plugins
   - Load each plugin's manifest (plugin.yaml)
   - Validate required fields: name, version, description, main, apiVersion, permissions
   - Load within 2 seconds (NFR-I1)

2. **Given** plugin has invalid manifest or incompatible API
   - Plugin NOT loaded
   - Error logged with validation details
   - Warning: "Plugin 'my-plugin' failed to load: incompatible API version 2.0"

3. **Given** plugin throws error during init
   - Marked as "failed"
   - Core system not affected (isolation)

4. **Given** I run `ao plugins`
   - Display table of plugins: name, version, status, description
   - Count loaded plugins

5. **Given** plugin requests runtime permission
   - Grant access to Runtime interface
   - Log permission grant

6. **Given** plugin attempts operation beyond permissions
   - PermissionError thrown
   - Error logged with plugin name and operation

7. **Given** I run `ao plugins --reload`
   - All plugins unloaded and reloaded
   - Validation runs again
   - System continues operating

## Tasks / Subtasks

- [ ] Create PluginLoader service
  - [ ] Scan plugins directory
  - [ ] Load and validate manifests
  - [ ] Isolation boundaries between plugins
  - [ ] Permission checking
- [ ] Implement plugin manifest validation
  - [ ] Required fields check
  - [ ] API version compatibility
  - [ ] Schema validation
- [ ] Implement permission system
  - [ ] Declare permissions in manifest
  - [ ] Check permissions at operation time
  - [ ] Grant access via config
- [ ] CLI command `ao plugins`
  - [ ] List all plugins with status
  - [ ] Show load errors
  - [ ] Display summary count
- [ ] Implement hot reload
  - [ ] `ao plugins --reload`
  - [ ] Unload and reload all plugins
  - [ ] Validate after reload
- [ ] Write unit tests

## Dev Notes

### Plugin Manifest Format

```yaml
# plugins/my-plugin/plugin.yaml
name: "my-plugin"
version: "1.0.0"
description: "My custom plugin"
apiVersion: "1.0.0"
main: "./index.js"
permissions:
  - runtime
  - tracker
  - notifier
```

### Plugin Interface

```typescript
// @composio/ao-plugin-api
export interface Plugin {
  name: string;
  version: string;
  init(): Promise<void>;
  onEvent?(event: Event): Promise<void>;
  shutdown(): Promise<void>;
}
```

### Dependencies

- @composio/ao-core - Core types
- Story 2.1 (Event Bus) - Event subscription

## Dev Agent Record

_(To be filled by Dev Agent)_
