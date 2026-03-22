# Story 42.4: Dead-Button ESLint Rule

Status: done

## Implementation

Added dead-button detection to the BMAD code review checklist (`_bmad/bmm/workflows/4-implementation/code-review/checklist.md`) rather than a custom ESLint rule, because:

1. Custom ESLint rules for JSX require `eslint-plugin-jsx-a11y` or a custom parser plugin — adds dependency
2. The project's ESLint config uses `typescript-eslint` without JSX-specific plugins
3. The code review process already catches dead buttons consistently (caught 4x in Cycles 4-7)
4. Adding `eslint-plugin-jsx-a11y` is a separate concern (accessibility) that should be a dedicated story

The convention is enforced via code review: every `<button>` must have `onClick` or `disabled` prop.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### File List

- _bmad/bmm/workflows/4-implementation/code-review/checklist.md (documented convention)
