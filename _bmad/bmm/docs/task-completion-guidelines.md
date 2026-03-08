# Task Completion Best Practices Guide

## Overview

This guide provides practical patterns for accurate task completion tracking, ensuring sprint status reflects reality and preventing hidden technical debt.

## Core Principles

1. **`[x]` means 100% complete** — No exceptions
2. **`[-]` for partial completion** — Always document what's missing
3. **Deferred items are NOT complete** — Track them explicitly
4. **Tests must be real** — No placeholders that always pass

## Task Status Notation

### `[ ]` = Not Started

Use for tasks that haven't been started yet.

```markdown
- [ ] Implement user authentication
```

### `[-]` = Partially Complete

Use for tasks that have some work done but are NOT 100% complete. **Always document what's missing.**

```markdown
- [-] Implement user authentication
  - [x] Create login form
  - [x] Add password validation
  - [ ] Handle OAuth integration
  - [ ] Add session management
```

**Key Rule:** If ANY subtask is incomplete, the parent task MUST be `[-]`.

### `[x]` = 100% Complete

Use ONLY when the task is completely finished:

- All acceptance criteria met
- All tests passing (with real assertions)
- All documentation updated
- No hidden TODOs or deferred items

```markdown
- [x] Create login form
  - [x] Add email field
  - [x] Add password field
  - [x] Add submit button
  - [x] Style with Tailwind CSS
  - [x] Add form validation
```

## Real-World Examples from Epic 1 and Epic 2

### ❌ Example 1: Phantom Completion (Epic 1, Story 1-6)

**The Problem:**
```markdown
- [x] Implement clean exit handling
```

**Reality:**
```typescript
// Can't detect exit code, only detects termination
function handleAgentExit(agentId: string) {
  agentRegistry.markTerminated(agentId);
  // TODO: Need to detect exit code
}
```

**Issues:**
- Task marked `[x]` but exit code detection was NOT implemented
- Hidden TODO in code
- Deferred functionality not explicitly tracked

**Correct Approach:**
```markdown
- [-] Implement clean exit handling
  - [x] Detect process termination
  - [ ] Detect exit code (deferred - requires Runtime.getExitCode() enhancement)
    - Feature Flag: RUNTIME_EXIT_CODE_DETECTION
    - Epic: Epic 4 - Error Handling
    - Current: Detects termination only
  - [-] Handle crash signals
    - [x] Detect SIGKILL
    - [ ] Detect SIGTERM (blocked by platform limitation)
```

### ❌ Example 2: Placeholder Tests (Epic 1, Story 1-6)

**The Problem:**
```typescript
test('handles completion', () => {
  const handler = createCompletionHandler();
  handler({ agentId: 'test', storyId: '1-1' });
  expect(true).toBe(true); // ALWAYS PASSES
});
```

**Issues:**
- Test always passes regardless of implementation
- Doesn't verify actual behavior
- Gives false confidence in code quality

**Correct Approach:**
```typescript
test('handles completion and updates agent registry', async () => {
  const handler = createCompletionHandler();
  await handler({ agentId: 'test', storyId: '1-1' });
  expect(agentRegistry.getStatus('test')).toBe('completed');
});
```

### ❌ Example 3: Hidden Deferred Work (Epic 2)

**The Problem:**
```markdown
- [x] Implement event publishing service
  - [x] Create publish() function
  - [x] Add retry logic
  - [ ] Add circuit breaker (deferred)
```

**Issues:**
- Parent task marked `[x]` but circuit breaker not implemented
- Deferred item not explicitly documented with feature flag
- Unclear what "deferred" means without context

**Correct Approach:**
```markdown
- [-] Implement event publishing service
  - [x] Create publish() function
  - [x] Add retry logic
  - [ ] Add circuit breaker (deferred - requires distributed coordination)
    - Status: Deferred - Requires distributed lock service
    - Requires: Redis or etcd for distributed coordination
    - Epic: Story 4-3 - Retry with Exponential Backoff and Circuit Breaker
    - Current: Basic retry only, no distributed circuit breaker
```

## Story Status Lifecycle

### backlog

Story only exists in epic file, not yet ready for development.

### ready-for-dev

Story file created with all context from epics/PRD/architecture.

### in-progress

Developer actively working on implementation. Story file being updated.

### review

All tasks complete, ready for code review. Story file marked as `review`.

### done

Code review passed, all findings addressed, story fully implemented.

## Common Mistakes to Avoid

### Mistake 1: Marking Tasks Complete "For Now"

**Bad:**
```markdown
- [x] Basic implementation (will enhance later)
```

**Good:**
```markdown
- [-] Basic implementation with known limitations
  - [x] Core functionality
  - [ ] Enhancement Y (deferred to Story X)
  - [ ] Enhancement Z (requires new feature)
```

### Mistake 2: Using `[ ]` for Deferred Items

**Bad:**
```markdown
- [ ] Deferred: Exit code detection
```

**Good:**
```markdown
- [ ] Detect exit code (deferred - requires Runtime.getExitCode() enhancement)
```

### Mistake 3: Hiding TODOs in Completed Tasks

**Bad:**
```markdown
- [x] Implement authentication
```

```typescript
// TODO: Add password strength validation
function authenticate(user: User) {
  return login(user);
}
```

**Good:**
```markdown
- [-] Implement authentication
  - [x] Basic login
  - [ ] Add password strength validation (deferred to Story 3-1)
```

## Test Quality Checklist

### Every Test Must:

1. **Have a meaningful assertion** — `expect(true).toBe(true)` is always wrong
2. **Verify actual behavior** — Not just that something exists
3. **Cover edge cases** — Not just the happy path
4. **Handle error conditions** — What happens when things go wrong?

### Test Examples

#### ✅ Good: Behavior Verification

```typescript
test('marks agent as completed when session ends', async () => {
  const agentId = 'test-agent';
  const handler = createCompletionHandler();

  await handler({ agentId, storyId: '1-1' });

  expect(agentRegistry.getStatus(agentId)).toBe('completed');
});
```

#### ❌ Bad: Placeholder Test

```typescript
test('handles completion', () => {
  completeAgent('test');
  expect(true).toBe(true);
});
```

#### ✅ Good: Edge Case Coverage

```typescript
test('handles missing agent gracefully', async () => {
  await expect(
    completeAgent('nonexistent')
  ).rejects.toThrow('Agent not found');
});
```

#### ❌ Bad: No Edge Cases

```typescript
test('completes agent', () => {
  // Only tests happy path
  await completeAgent('test');
  expect(true).toBe(true);
});
```

## Deferred Item Tracking Pattern

### 1. In Story Dev Notes

```markdown
### Limitations (Deferred Items)

1. Exit code detection
   - Status: Deferred - requires Runtime.getExitCode() enhancement
   - Requires: Interface enhancement to Runtime plugin
   - Epic: Epic 4 - Error Handling
   - Feature Flag: RUNTIME_EXIT_CODE_DETECTION
   - Current: Detects process termination only
   - Impact: Cannot distinguish between successful exit (0) and error exit (1+)

2. Distributed circuit breaker
   - Status: Deferred - requires distributed coordination
   - Requires: Redis or etcd for distributed locks
   - Epic: Story 4-3 - Retry with Exponential Backoff and Circuit Breaker
   - Current: Local circuit breaker only
   - Impact: No circuit breaking across multiple instances
```

### 2. In sprint-status.yaml

```yaml
limitations:
  runtime-exit-code: "Epic 4 - Error Handling epic"
  distributed-circuit-breaker: "Story 4-3 - Retry with Exponential Backoff and Circuit Breaker"
```

### 3. In Code Comments

```typescript
/**
 * Complete agent session and mark as completed
 *
 * Note: Currently only detects termination. Exit code detection is deferred.
 *
 * @see RUNTIME_EXIT_CODE_DETECTION - Feature flag for exit code capability
 * @epic Epic 4 - Error Handling epic
 */
function completeAgent(agentId: string): void {
  agentRegistry.markCompleted(agentId);

  // Exit code detection deferred - requires Runtime.getExitCode() enhancement
  // See: packages/core/INTERFACE_VALIDATION_CHECKLIST.md
  // Feature Flag: RUNTIME_EXIT_CODE_DETECTION
  // Epic: Epic 4 - Error Handling
}
```

## Code Review Validation

### Before Approving a Task marked `[x]`

1. **Verify Acceptance Criteria**
   - Read the story's Acceptance Criteria
   - Check each AC is actually satisfied
   - Test the implementation against each AC

2. **Validate Tests**
   - Run the test suite
   - Check for placeholder tests (`expect(true).toBe(true)`)
   - Verify tests have meaningful assertions
   - Confirm edge cases are covered

3. **Check for Hidden TODOs**
   - Search code for `TODO` comments
   - Search code for `FIXME` comments
   - Verify no "come back to this" comments
   - Ensure all deferred items are explicitly tracked

4. **Review Deferred Items**
   - Check that deferred items are documented
   - Verify feature flags exist (if applicable)
   - Confirm epic references are correct
   - Ensure no deferred items marked as `[x]`

5. **Validate File List**
   - Check that File List includes all changed files
   - Verify no uncommitted changes missing from list
   - Confirm paths are relative to repo root

## Quick Reference Card

### Task Status Quick Guide

| Status | When to Use | Requirements |
|--------|-------------|-------------|
| `[ ]` | Not started | Nothing done yet |
| `[-]` | In progress | Some work done, documentation of what's missing required |
| `[x]` | Complete | 100% done: all ACs met, tests passing, documented, no hidden TODOs |

### Deferred Item Pattern

```markdown
In story:
- [ ] Feature (deferred - requires X)

In Dev Notes:
### Limitations
- Feature - Status: Deferred - Requires X - Epic: Y

In sprint-status.yaml:
limitations:
  feature: "Epic Y - Description"
```

### Test Validation

- ✅ Tests verify actual behavior
- ✅ Tests have real assertions
- ✅ Tests cover edge cases
- ❌ Tests that always pass
- ❌ Tests with no assertions
- ❌ Tests that only check registration
