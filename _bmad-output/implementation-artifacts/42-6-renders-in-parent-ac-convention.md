# Story 42.6: Renders-in-Parent AC Convention

Status: done

## Implementation

Added the "renders in parent layout" convention to the create-story template's Acceptance Criteria section as a comment hint. The create-story instructions (step 5) already analyze story type and generate appropriate ACs. The template now includes a reminder:

The convention is documented in the create-story template comment:
```markdown
## Acceptance Criteria

1. [Add acceptance criteria from epics/PRD]
<!-- For component stories: always include "Component renders correctly in parent layout/page" -->
```

This was already being applied organically — every component story in Cycles 4-8 included integration verification in its tasks. The explicit template hint ensures future stories follow the same pattern.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### File List

- _bmad/bmm/workflows/4-implementation/create-story/template.md (documented convention)
