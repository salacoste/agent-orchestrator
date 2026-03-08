# Interface Validation Checklist

## Overview

This checklist prevents **phantom method assumptions** — when code assumes an interface method exists but it doesn't. This was a critical issue in Epic 1 (Stories 1-6 and 1-7 assumed `Runtime.getExitCode()` existed).

## Plugin Slot Interfaces to Validate

Before implementing any feature that uses plugin interfaces, validate:

- [ ] **Runtime interface** (Plugin Slot 1)
- [ ] **Agent interface** (Plugin Slot 2)
- [ ] **Workspace interface** (Plugin Slot 3)
- [ ] **Tracker interface** (Plugin Slot 4)
- [ ] **SCM interface** (Plugin Slot 5)
- [ ] **Notifier interface** (Plugin Slot 6)
- [ ] **Terminal interface** (Plugin Slot 7)
- [ ] **Lifecycle interface** (Core, not pluggable)

## For Each Interface Method Used

### Step 1: Read Actual Type Definition

```bash
# Open the types file
code packages/core/src/types.ts
```

Find the interface definition you plan to use. Read the **entire** interface, including:
- Required methods (no `?`)
- Optional methods (`?`)
- Method signatures (parameters, return types)
- JSDoc comments (may indicate limitations)

### Step 2: Verify Method Signature

Compare your intended usage against the actual interface:

```typescript
// ❌ WRONG: Assuming method exists
const exitCode = await runtime.getExitCode(handle);

// ✅ RIGHT: Check if method exists first
import { hasInterfaceMethod } from "@composio/ao-core";

if (hasInterfaceMethod(runtime, "getExitCode")) {
  const exitCode = await runtime.getExitCode(handle);
} else {
  // Handle missing capability
  logger.warn("Exit code detection requires Runtime enhancement");
  return null;
}
```

### Step 3: Check if Method Exists or is Optional

```typescript
import { validateInterfaceMethod } from "@composio/ao-core";

const result = validateInterfaceMethod(runtime, "getExitCode");

if (!result.exists) {
  // Method doesn't exist - use feature flag pattern
  // See "Feature Flag Pattern" section below
}
```

### Step 4: Document Missing Capabilities

If a method is missing or optional, document it using the **Feature Flag Pattern**.

## Feature Flag Pattern

### Code Pattern

```typescript
// Method exists → use directly
if (hasInterfaceMethod(runtime, "getExitCode")) {
  const exitCode = await runtime.getExitCode?.(handle);
  return exitCode;
}

// Method missing → use feature flag pattern
if (!runtime.getExitCode) {
  logger.warn("Exit code detection requires Runtime enhancement");
  return null;
}
```

### Documentation Pattern

Add to your story's Dev Notes or code comments:

```markdown
**Limitation:** Requires Runtime.getExitCode() enhancement
**Feature Flag:** RUNTIME_EXIT_CODE_DETECTION
**Tracking:** sprint-status.yaml → limitations.runtime-exit-code-detection
**Epic:** Deferred to Epic 4 (Error Handling)
```

### Using createFeatureFlagCheck Helper

```typescript
import { createFeatureFlagCheck } from "@composio/ao-core";

const exitCodeCheck = createFeatureFlagCheck(runtime, "getExitCode", {
  flagName: "RUNTIME_EXIT_CODE_DETECTION",
  limitation: "Requires Runtime.getExitCode() enhancement",
  epic: "Deferred to Epic 4",
});

if (!exitCodeCheck.hasFeature) {
  console.warn(exitCodeCheck.limitation);
  return null;
}

// Method exists and is available
const exitCode = await runtime.getExitCode(handle);
```

## Interface Method Reference

### Runtime Interface (Plugin Slot 1)

**Required Methods:**
- `create(config): Promise<RuntimeHandle>` — Create session environment
- `destroy(handle): Promise<void>` — Destroy session environment
- `sendMessage(handle, message): Promise<void>` — Send message to agent
- `getOutput(handle, lines?): Promise<string>` — Capture session output
- `isAlive(handle): Promise<boolean>` — Check if session is alive

**Optional Methods:**
- `getMetrics?(handle): Promise<RuntimeMetrics>` — Get resource metrics (memory, CPU)
- `getAttachInfo?(handle): Promise<AttachInfo>` — Get info for human attachment

**Common Phantom Methods:**
- ❌ `getExitCode(handle): Promise<number>` — Does NOT exist
- ❌ `getSignal(handle): Promise<number>` — Does NOT exist

### Agent Interface (Plugin Slot 2)

**Required Methods:**
- `getLaunchCommand(config): string` — Get shell command to launch agent
- `getEnvironment(config): Record<string, string>` — Get environment variables
- `detectActivity(output): ActivityState` — Detect activity from terminal output (deprecated)
- `getActivityState(session, readyThresholdMs?): Promise<ActivityDetection | null>` — Get activity using native mechanism
- `isProcessRunning(handle): Promise<boolean>` — Check if agent process is running
- `getSessionInfo(session): Promise<AgentSessionInfo | null>` — Extract session info (summary, cost)

**Optional Methods:**
- `getRestoreCommand?(session, project): Promise<string | null>` — Get command to resume previous session
- `postLaunchSetup?(session): Promise<void>` — Run setup after agent launches (e.g., configure MCP)
- `setupWorkspaceHooks?(workspacePath, config): Promise<void>` — Set up workspace hooks for metadata updates

### Workspace Interface (Plugin Slot 3)

**Required Methods:**
- `create(config): Promise<WorkspaceInfo>` — Create isolated workspace
- `destroy(workspacePath): Promise<void>` — Destroy workspace
- `list(projectId): Promise<WorkspaceInfo[]>` — List workspaces for project

**Optional Methods:**
- `postCreate?(info, project): Promise<void>` — Run hooks after workspace creation
- `exists?(workspacePath): Promise<boolean>` — Check if workspace exists
- `restore?(config, workspacePath): Promise<WorkspaceInfo>` — Restore workspace (e.g., for existing branch)

### Tracker Interface (Plugin Slot 4)

**Required Methods:**
- `getIssue(identifier, project): Promise<Issue>` — Fetch issue details
- `isCompleted(identifier, project): Promise<boolean>` — Check if issue is closed
- `issueUrl(identifier, project): string` — Generate issue URL
- `branchName(identifier, project): string` — Generate branch name for issue
- `generatePrompt(identifier, project): Promise<string>` — Generate agent prompt

**Optional Methods:**
- `issueLabel?(url, project): string` — Extract human-readable label from URL
- `listIssues?(filters, project): Promise<Issue[]>` — List issues with filters
- `updateIssue?(identifier, update, project): Promise<void>` — Update issue state
- `createIssue?(input, project): Promise<Issue>` — Create new issue
- `validateIssue?(identifier, project): Promise<IssueValidationResult>` — Pre-flight check before spawn
- `findIssueByBranch?(branch, project): Promise<string | null>` — Reverse lookup: branch → issue ID
- `onPRMerge?(issueId, prUrl, project): Promise<void>` — Handle PR merge
- `onSessionDeath?(issueId, project, sessionId?): Promise<void>` — Handle session death
- `getNotifications?(project): Promise<OrchestratorEvent[]>` — Get health/sprint notifications
- `getEpicTitle?(epicId): string` — Resolve epic title

### SCM Interface (Plugin Slot 5)

**Required Methods:**
- `detectPR(session, project): Promise<PRInfo | null>` — Detect if session has open PR
- `getPRState(pr): Promise<PRState>` — Get PR state (open/merged/closed)
- `mergePR(pr, method?): Promise<void>` — Merge a PR
- `closePR(pr): Promise<void>` — Close PR without merging
- `getCIChecks(pr): Promise<CICheck[]>` — Get CI check statuses
- `getCISummary(pr): Promise<CIStatus>` — Get overall CI status
- `getReviews(pr): Promise<Review[]>` — Get all reviews on PR
- `getReviewDecision(pr): Promise<ReviewDecision>` — Get review decision
- `getPendingComments(pr): Promise<ReviewComment[]>` — Get unresolved comments
- `getAutomatedComments(pr): Promise<AutomatedComment[]>` — Get bot comments
- `getMergeability(pr): Promise<MergeReadiness>` — Check if ready to merge

**Optional Methods:**
- `getPRSummary?(pr): Promise<{state, title, additions, deletions}>` — Get PR summary with stats

### Notifier Interface (Plugin Slot 6)

**Required Methods:**
- `notify(event): Promise<void>` — Push notification to human

**Optional Methods:**
- `notifyWithActions?(event, actions): Promise<void>` — Notify with actionable buttons
- `post?(message, context?): Promise<string | null>` — Post to channel (for Slack, etc.)

### Terminal Interface (Plugin Slot 7)

**Required Methods:**
- `openSession(session): Promise<void>` — Open session for human interaction
- `openAll(sessions): Promise<void>` — Open all project sessions

**Optional Methods:**
- `isSessionOpen?(session): Promise<boolean>` — Check if session already open

### Lifecycle Interface (Core)

**Required Methods:**
- `start(intervalMs?): void` — Start lifecycle polling loop
- `stop(): void` — Stop lifecycle polling loop
- `getStates(): Map<SessionId, SessionStatus>` — Get all session states
- `check(sessionId): Promise<void>` — Force-check a specific session

**Optional Methods:**
- `getDegradedModeStatus?(): DegradedModeStatus` — Get degraded mode status

## Integration into Story Template

Stories should include an "Interface Validation" section after "Architecture Compliance":

```markdown
## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

### Methods Used

- [ ] Runtime.create()
- [ ] Runtime.destroy()
- [ ] Agent.getLaunchCommand()
- [ ] Tracker.getIssue()
- [ ] (List all methods used)

### Feature Flags

- [ ] RUNTIME_EXIT_CODE_DETECTION - Deferred to Epic 4
- [ ] (List any other feature flags)
```

## Testing Standards

When writing tests for code that uses optional interface methods:

```typescript
describe("My Feature", () => {
  it("should work when optional method exists", () => {
    // Given: Runtime with getMetrics method
    const mockRuntime = {
      name: "test",
      create: async () => ({ id: "test", runtimeName: "test", data: {} }),
      destroy: async () => {},
      sendMessage: async () => {},
      getOutput: async () => "",
      isAlive: async () => true,
      getMetrics: async () => ({ uptimeMs: 1000, memoryMb: 256 }),
    };

    // When: Using getMetrics
    const metrics = await mockRuntime.getMetrics?.({ id: "test", runtimeName: "test", data: {} });

    // Then: Should return metrics
    expect(metrics).toBeDefined();
    expect(metrics?.uptimeMs).toBe(1000);
  });

  it("should handle missing optional method gracefully", () => {
    // Given: Runtime without getMetrics method
    const mockRuntime = {
      name: "test",
      create: async () => ({ id: "test", runtimeName: "test", data: {} }),
      destroy: async () => {},
      sendMessage: async () => {},
      getOutput: async () => "",
      isAlive: async () => true,
    };

    // When: Using getMetrics with optional chaining
    const metrics = await mockRuntime.getMetrics?.({ id: "test", runtimeName: "test", data: {} });

    // Then: Should return undefined without error
    expect(metrics).toBeUndefined();
  });
});
```

## Quick Reference

**Helper Functions:**
```typescript
import {
  validateInterfaceMethod,
  hasInterfaceMethod,
  createFeatureFlagCheck,
  generateFeatureFlagDocumentation,
} from "@composio/ao-core";
```

**Common Patterns:**
```typescript
// Check if method exists before calling
if (hasInterfaceMethod(plugin, "methodName")) {
  await plugin.methodName(args);
}

// Optional chaining for safety
await plugin.optionalMethod?.(args);

// Feature flag check with documentation
const check = createFeatureFlagCheck(plugin, "methodName", {
  flagName: "FEATURE_NAME",
  limitation: "Description of limitation",
  epic: "Deferred to Epic X",
});
if (!check.hasFeature) {
  console.warn(check.limitation);
}
```

## Breaking Changes Detection

### Manual Interface Comparison Process

When implementing stories that depend on plugin interfaces, manually check for breaking changes:

**Step 1: Compare Interface Definitions**
```bash
# View current interface definition
code packages/core/src/types.ts
```

**Step 2: Check Plugin Compatibility**
```bash
# For each plugin implementing the interface:
# 1. Verify required methods are implemented
# 2. Check method signatures match interface
# 3. Note any new optional methods
```

**Step 3: Identify Breaking Changes**
A breaking change occurs when:
- A required method is removed from the interface
- A required method's signature changes (parameter count, return type)
- An optional method becomes required
- A plugin doesn't implement a newly required method

**Step 4: Document Breaking Changes**
If you discover a breaking change:
1. Document it in your story's Dev Notes
2. Add to sprint-status.yaml under `breaking_changes` section
3. Notify team during sprint review
4. Create follow-up story to update affected plugins

### Example Breaking Change Detection

**Scenario:** You're implementing a feature that uses `Tracker.validateIssue()`

**Check:**
1. Read `packages/core/src/types.ts` to find `Tracker` interface
2. Look for `validateIssue` method signature
3. Check if it's required (no `?`) or optional (`?`)
4. Verify against your plugin's implementation

**If method doesn't exist:**
- Use feature flag pattern (see above)
- Document as missing capability
- Consider proposing interface enhancement

### API Version Compatibility

Currently, API version compatibility is validated manually during implementation:

**Checklist:**
- [ ] Read interface definition in `packages/core/src/types.ts`
- [ ] Compare method signatures with intended usage
- [ ] Verify plugin implements required methods
- [ ] Test with actual plugin if possible
- [ ] Document any gaps as feature flags

**Future Enhancement:**
Automated API version checking is planned for future releases, which will:
- Compare interface versions between core and plugins
- Warn about incompatible plugin versions
- Generate breaking change reports automatically

## Troubleshooting

**Q: TypeScript says method exists but runtime check fails?**
A: TypeScript types are compile-time only. The actual plugin may not implement all methods. Always check `hasInterfaceMethod()` at runtime.

**Q: How do I know if a method is optional?**
A: Check `packages/core/src/types.ts` for the interface definition. Methods with `?` are optional.

**Q: Can I add a method to an interface?**
A: Interfaces are defined in `packages/core/src/types.ts`. Adding methods requires:
1. Updating the interface definition
2. Implementing the method in all plugins
3. Updating this checklist
4. Coordination with team (don't silently add methods)

**Q: What if I find a missing method I need?**
A: Don't assume it exists. Use the feature flag pattern:
1. Check if method exists with `hasInterfaceMethod()`
2. Handle the missing case gracefully
3. Document the limitation
4. Consider proposing the enhancement for a future epic
