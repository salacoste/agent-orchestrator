# Task Completion Validation Checklist

## Overview

This checklist ensures that tasks marked as complete (`[x]`) are actually 100% complete, preventing misleading sprint status and hidden technical debt.

## Core Principles

1. **`[x]` means 100% complete** — No exceptions
2. **`[-]` for partial completion** — Always document what's missing
3. **Deferred items are NOT complete** — Track them explicitly
4. **Tests must be real** — No placeholders that always pass

## Task Completion Validation

### 1. All Acceptance Criteria Met

**Check:** Does the implementation satisfy ALL acceptance criteria in the story?

- [ ] Read the story's Acceptance Criteria section completely
- [ ] Verify each AC is implemented (not just attempted)
- [ ] Test the implementation against each AC
- [ ] Confirm edge cases are handled

**Red Flags:**
- ❌ "Implemented basic version, will add more later" → Mark as `[-]`
- ❌ "Tried X but couldn't complete" → Mark as `[-]`
- ❌ "TODO: Complete remaining ACs" → Mark as `[-]`

### 2. All Tests Passing

**Check:** Do all tests pass with real assertions?

- [ ] Run the test suite for this task
- [ ] Verify no test failures
- [ ] Confirm tests have meaningful assertions (not placeholders)
- [ ] Check integration tests if applicable

**Placeholder Test Examples (REJECT):**
```typescript
// ❌ ALWAYS PASSES - Meaningless
test('placeholder', () => {
  expect(true).toBe(true);
});

// ❌ NO ASSERTION - Doesn't verify anything
test('registers handler', () => {
  registerHandler();
});

// ❌ ONLY CHECKS REGISTRATION - Doesn't test behavior
test('handler exists', () => {
  expect(handlerRegistry.get('test')).toBeDefined();
});
```

**Valid Test Examples (ACCEPT):**
```typescript
// ✅ Real assertion with behavior verification
test('completes agent and updates status', async () => {
  const handler = createCompletionHandler();
  await handler({ agentId: 'test', storyId: '1-1' });
  expect(agentRegistry.getStatus('test')).toBe('completed');
});

// ✅ Tests actual functionality
test('validates input before processing', () => {
  const result = validateTaskInput({ name: 'test' });
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});
```

### 3. Code Review Completed (if required)

**Check:** Has the code been reviewed according to story requirements?

- [ ] Code review workflow completed (if story requires it)
- [ ] Review findings addressed
- [ ] No blocking issues remain
- [ ] Reviewer explicitly validated completion

### 4. Documentation Updated

**Check:** Is all required documentation in place?

- [ ] Code comments explain complex logic
- [ ] API documentation updated (if applicable)
- [ ] Story Dev Notes filled out
- [ ] File List updated with all changes

### 5. No Hidden TODOs or Deferred Items

**Check:** Are there any hidden TODOs in completed code?

- [ ] Search for `TODO` comments in implementation
- [ ] Search for `FIXME` comments in implementation
- [ ] Search for `deferred` comments in implementation
- [ ] Verify no "come back to this" comments

**If TODOs found in task marked `[x]`:**
- This is INVALID — task should be marked `[-]`
- Move TODO to explicit tracking in Dev Notes
- Add to limitations section if truly deferred

## Partial Task Tracking

### Use `[-]` for Incomplete Work

**Correct Pattern:**
```markdown
- [ ] Implement user authentication
  - [x] Create login form
  - [x] Add password validation
  - [-] Handle OAuth integration
    - [x] Implement Google OAuth
    - [ ] Implement GitHub OAuth (deferred - requires GitHub app setup)
  - [-] Add session management
    - [x] Create session middleware
    - [ ] Add session timeout (deferred - requires Redis)
```

**Key Points:**
- Parent task gets `[-]` if ANY subtask is incomplete
- Document deferred items explicitly with `(deferred - reason)`
- Never mark parent task `[x]` when subtasks are incomplete

### Deferred Item Tracking

**In Story Dev Notes:**
```markdown
### Limitations (Deferred Items)

1. GitHub OAuth integration
   - Status: Deferred - requires GitHub app setup
   - Requires: GitHub OAuth app credentials
   - Epic: N/A (external dependency)
   - Feature Flag: GITHUB_OAUTH_ENABLED

2. Session timeout
   - Status: Deferred - requires Redis
   - Requires: Redis configuration in production
   - Epic: Story 3-2 - Session Management
   - Current: In-memory sessions only
```

**In sprint-status.yaml:**
```yaml
limitations:
  github-oauth: "Requires GitHub app setup - external dependency"
  session-timeout: "Story 3-2 - Session Management"
```

## Code Review Validation Checklist

Use this checklist during code review to validate task completion:

### Story File Review

- [ ] All tasks marked `[x]` have corresponding implementation
- [ ] No tasks marked `[x]` with placeholder tests
- [ ] No tasks marked `[x]` with hidden TODOs
- [ ] Deferred items explicitly tracked in Dev Notes
- [ ] File List includes all changed files
- [ ] Dev Agent Record has meaningful completion notes

### Test Quality Review

- [ ] Tests have real assertions (not `expect(true).toBe(true)`)
- [ ] Tests verify actual behavior, not just registration
- [ ] Edge cases covered (not just happy path)
- [ ] Error conditions tested
- [ ] Tests are deterministic (no flaky timers)

### Deferred Item Review

- [ ] Deferred items listed in Dev Notes
- [ ] Deferred items have feature flags (if applicable)
- [ ] Deferred items reference future epics if known
- [ ] No deferred items marked as `[x]` (done)

## Common Anti-Patterns

### ❌ Marking Partial Work as Complete

**Bad:**
```markdown
- [x] Implement agent completion detection
  - [x] Detect termination
  - TODO: Detect exit code (requires Runtime enhancement)
```

**Good:**
```markdown
- [-] Implement agent completion detection
  - [x] Detect termination
  - [ ] Detect exit code (deferred - requires Runtime.getExitCode() enhancement)
    - Feature Flag: RUNTIME_EXIT_CODE_DETECTION
    - Epic: Epic 4 - Error Handling
```

### ❌ Placeholder Tests

**Bad:**
```typescript
test('completes agent', () => {
  completeAgent('test');
  expect(true).toBe(true); // Always passes
});
```

**Good:**
```typescript
test('completes agent and updates status', async () => {
  await completeAgent('test');
  expect(agentRegistry.getStatus('test')).toBe('completed');
});
```

### ❌ Hidden TODOs

**Bad:**
```typescript
// TODO: Handle error case
function processTask(task: Task) {
  executeTask(task);
  // Missing error handling
}
```

**Good:**
```markdown
## Dev Notes

### Limitations
- Error handling: Current implementation assumes task execution succeeds. Error handling deferred to Story 2-4.

## Implementation
function processTask(task: Task) {
  executeTask(task);
  // Error handling: Story 2-4 will add try/catch with retry logic
}
```

## Quick Reference

**Task Status Notation:**
- `[ ]` = Not started
- `[-]` = Partially complete (document what's missing)
- `[x]` = 100% complete (all requirements met, all tests passing)

**Validation Order:**
1. Acceptance criteria met?
2. Tests passing with real assertions?
3. Code review completed?
4. Documentation updated?
5. No hidden TODOs?

**Deferred Item Pattern:**
```markdown
In Dev Notes:
### Limitations
- Feature name - Status: Deferred - Requires X - Epic: Y

In sprint-status.yaml:
limitations:
  feature-name: "Epic Y - Description"
```
