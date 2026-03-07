# Story 6.5: Plugin Installation CLI

Status: ready-for-dev

## Story

As a Developer,
I want to install, list, and uninstall plugins from the command line,
so that I can manage my plugins without manual file operations.

## Acceptance Criteria

1. **Given** I run `ao plugin install @composio/ao-plugin-slack`
   - Download from npm
   - Validate manifest
   - Check API version
   - Install to plugins directory
   - Run `ao plugin load`
   - Display: "Installed @composio/ao-plugin-slack v1.2.0"

2. **Given** plugin requires permissions
   - Display: "Plugin requires permissions: notifier, tracker"
   - Prompt: "Grant permissions? [y/N]"
   - Cancelled if denied, grant if confirmed

3. **Given** I run `ao plugin list`
   - Table with: plugin name, version, status, permissions
   - Summary count: "3 plugins installed"

4. **Given** I run `ao plugin uninstall`
   - Unload plugin from memory
   - Remove from plugins directory
   - Remove config
   - Prompt if dependencies exist

5. **Given** I run `ao plugin update`
   - Check for updates on npm
   - Show versions: "Update from 1.2.0 to 1.3.0? [y/N]"
   - Install if confirmed

6. **Given** I run `ao plugin search slack`
   - Query community registry
   - Display matching plugins with downloads

## Tasks / Subtasks

- [ ] CLI command `ao plugin install <package>`
  - [ ] Download from npm or local path
  - [ ] Validate manifest
  - [ ] Check API version
  - [ ] Grant permissions prompt
  - [ ] Install and load
- [ ] CLI command `ao plugin list`
  - [ ] Display table of plugins
  - [ ] Show status: loaded, disabled, failed
  - [ ] Show permissions
- [ ] CLI command `ao plugin uninstall <package>`
  - [ ] Unload plugin
  - [ ] Remove from directory
  - [ ] Dependency check and prompt
- [ ] CLI command `ao plugin update <package>`
  - [ ] Check for updates
  - [ ] Version comparison
  - [ ] Install new version
- [ ] CLI command `ao plugin search <query>`
  - [ ] Query community registry
  - [ ] Display results with downloads
- [ ] CLI command `ao plugin disable/enable <package>`
  - [ ] Temporarily disable plugin
  - [ ] Re-enable disabled plugin
- [ ] Write unit tests

## Dev Notes

### CLI Commands

```bash
ao plugin install @composio/ao-plugin-slack
ao plugin list
ao plugin info @composio/ao-plugin-slack
ao plugin uninstall @composio/ao-plugin-slack
ao plugin update @composio/ao-plugin-slack
ao plugin search slack
ao plugin disable <package>
ao plugin enable <package>
```

### Plugin Table Output

```
Plugin                        | Version | Status    | Permissions
-----------------------------|---------|-----------|-------------------------
@composio/ao-plugin-slack     | 1.2.0   | ✅ Loaded  | notifier
@composio/ao-plugin-github    | 0.9.0   | ❌ Failed  | scm, tracker
my-custom-plugin              | 1.0.0   | ⚠️ Disabled | runtime
```

### Dependencies

- Story 6.1 (Plugin System) - Plugin loading
- npm - Plugin source

## Dev Agent Record

_(To be filled by Dev Agent)_
