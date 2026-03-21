# Story 18.1: Commander's Intent in Agent Prompts

Status: done

## Story

As a **developer**,
I want agent prompts to include goal-based "Commander's Intent" alongside prescriptive specs,
So that agents can adapt when prescribed approaches fail.

## Acceptance Criteria

1. **AC1: Commander's Intent section added to story prompts**
   - **Given** a story spec with title and acceptance criteria
   - **When** an agent is spawned with story context
   - **Then** the prompt includes a "Commander's Intent" section between AC and closing
   - **And** the intent is a prose statement of the outcome goal, not implementation method

2. **AC2: Intent auto-generated from story metadata**
   - **Given** a story with title "Implement session timeout" and acceptance criteria
   - **When** the intent is generated
   - **Then** it produces: "The intent of this story is to implement session timeout. If you encounter obstacles with the planned approach, any solution that achieves session timeout functionality with the specified acceptance criteria is acceptable."
   - **And** no manual intent authoring required

3. **AC3: Backward compatible — existing prompts unchanged**
   - **Given** a story spawned WITHOUT Commander's Intent (old story format)
   - **When** the prompt is built
   - **Then** existing prompt structure is preserved
   - **And** no errors for stories without intent data

4. **AC4: Tests pass**
   - **Given** the enhanced `formatStoryPrompt()` function
   - **When** tests run
   - **Then** existing story context tests pass
   - **And** new tests verify Commander's Intent section is included

## Tasks / Subtasks

- [ ] Task 1: Add Commander's Intent generation to formatStoryPrompt (AC: #1, #2)
  - [ ] 1.1: In `packages/cli/src/lib/story-context.ts`, modify `formatStoryPrompt()`
  - [ ] 1.2: Generate intent from story title: "The intent of this story is to [title]. If you encounter obstacles, any solution achieving [title] with the acceptance criteria is acceptable."
  - [ ] 1.3: Insert as `## Commander's Intent` section after Acceptance Criteria, before closing separator

- [ ] Task 2: Maintain backward compatibility (AC: #3)
  - [ ] 2.1: Commander's Intent is always generated from title — no conditional logic needed
  - [ ] 2.2: If title is missing/empty, skip the section gracefully
  - [ ] 2.3: Verify existing prompt-builder tests pass unchanged

- [ ] Task 3: Write tests (AC: #4)
  - [ ] 3.1: Test formatStoryPrompt includes Commander's Intent section
  - [ ] 3.2: Test intent text contains story title
  - [ ] 3.3: Test graceful handling of empty/missing title

- [ ] Task 4: Validate
  - [ ] 4.1: `pnpm test` — all tests pass
  - [ ] 4.2: `pnpm build` — succeeds

## Dev Notes

### Architecture: CLI-Side Only

**CRITICAL: Modify `formatStoryPrompt()` in CLI, NOT `buildPrompt()` in core.**

The prompt builder in core already handles `storyContext` as pre-formatted markdown. Commander's Intent is part of the story context formatting, which lives in CLI's `story-context.ts`.

```
CLI: formatStoryPrompt(story) → markdown with Commander's Intent
  ↓
Core: buildPrompt({ storyContext: markdown }) → inserts in Layer 2
  ↓
Agent receives prompt with intent section
```

### Implementation Pattern

```typescript
// In formatStoryPrompt(), after Acceptance Criteria section:
const intentSection = story.title
  ? `\n## Commander's Intent\n\nThe intent of this story is to ${story.title.toLowerCase()}. If you encounter obstacles with the planned approach, any solution that achieves this goal while satisfying the acceptance criteria above is acceptable.\n`
  : "";
```

### Source Tree Components to Touch

| File | Action | Notes |
|------|--------|-------|
| `packages/cli/src/lib/story-context.ts` | MODIFY | Add intent generation to formatStoryPrompt() |
| `packages/cli/__tests__/lib/story-context.test.ts` | MODIFY | Add Commander's Intent tests |

### What NOT to Touch

- `packages/core/src/prompt-builder.ts` — already handles storyContext, no changes
- `packages/core/src/types.ts` — PromptBuildConfig interface unchanged
- `packages/core/src/session-manager.ts` — spawn flow unchanged

### References

- [Source: packages/cli/src/lib/story-context.ts] — formatStoryPrompt() function (lines 211-246)
- [Source: packages/core/src/prompt-builder.ts] — buildPrompt() Layer 2 story context insertion
- [Source: epics-cycle-3-4.md#Epic 7, Story 7.1] — Requirements

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
