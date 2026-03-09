# Story {{epic_num}}.{{story_num}}: {{story_title}}

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a {{role}},
I want {{action}},
so that {{benefit}}.

## Acceptance Criteria

1. [Add acceptance criteria from epics/PRD]

## Tasks / Subtasks

- [ ] Task 1 (AC: #)
  - [ ] Subtask 1.1
- [ ] Task 2 (AC: #)
  - [ ] Subtask 2.1

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented (see "Deferred Items Tracking" below)
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Deferred Items Tracking:**

If your task has deferred items or known limitations:

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Feature name
   - Status: Deferred - Requires X
   - Requires: Specific requirement
   - Epic: Story Y or Epic number
   - Current: What's currently implemented
```

**In sprint-status.yaml (if applicable), add:**
```yaml
limitations:
  feature-name: "Epic Y - Description or epic number"
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [ ] List each interface method this story will use
- [ ] Verify each method exists in packages/core/src/types.ts

**Feature Flags:**
- [ ] List any feature flags for missing capabilities
- [ ] Use pattern from packages/core/INTERFACE_VALIDATION_CHECKLIST.md

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [ ] Check if dependency is necessary (can existing code be used?)
- [ ] Run `pnpm audit` to check for known vulnerabilities
- [ ] Verify license compatibility (MIT, Apache-2.0, BSD, ISC are compatible)
- [ ] Review dependency health (maintainer active, recent updates)
- [ ] Document dependency in `_bmad/docs/DEPENDENCIES.md`
- [ ] Create review document in `_bmad/docs/dependency-reviews/<package>-<version>.md`
- [ ] Update sprint-status.yaml with dependency approval status

**License Compatibility:**
| License | Compatible |
|---------|------------|
| MIT | ✅ Yes |
| Apache-2.0 | ✅ Yes |
| BSD-2/3 | ✅ Yes |
| ISC | ✅ Yes |
| GPL-2/3 | ❌ No |
| AGPL-3 | ❌ No |

**Reference:** See `_bmad/docs/dependency-security-review-checklist.md` for complete dependency review process.

## CLI Integration Testing (if applicable)

**For stories that add or modify CLI commands:**

- [ ] Create CLI integration test in `packages/cli/__tests__/integration/`
- [ ] Test CLI argument parsing (all flags and options)
- [ ] Test CLI output formatting (stdout)
- [ ] Test CLI error handling (stderr and exit codes)
- [ ] Test with real config files (use `createTempEnv` helper)
- [ ] Test CLI → Core service integration paths

**CLI Test Pattern:**
```typescript
import { describe, it, expect } from "vitest";
import { runCliWithTsx } from "../integration/helpers/cli-test.js";
import { createTempEnv } from "../integration/helpers/temp-env.js";

describe("ao mycommand", () => {
  it("should execute successfully", async () => {
    const env = createTempEnv();
    try {
      const result = await runCliWithTsx(["mycommand"], { cwd: env.cwd });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("expected output");
    } finally {
      env.cleanup();
    }
  });
});
```

**Reference:** See `packages/cli/__tests__/CLI_TEST_README.md` for complete CLI testing guide.

## Dev Notes

- Relevant architecture patterns and constraints
- Source tree components to touch
- Testing standards summary

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming)
- Detected conflicts or variances (with rationale)

### References

- Cite all technical details with source paths and sections, e.g. [Source: docs/<file>.md#Section]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
