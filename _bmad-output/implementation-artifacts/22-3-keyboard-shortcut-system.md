# Story 22.3: Keyboard Shortcut System

Status: done

## Story
As a **power user**, I want full keyboard navigation throughout the dashboard, So that I can orchestrate without touching the mouse.

## Acceptance Criteria
1. `g+f` → fleet, `g+s` → sprint, `g+w` → workflow view
2. `n` → next notification, `space` → approve
3. `?` shows shortcut help modal
4. No conflicts with browser defaults

## Tasks
- [ ] Task 1: Create keyboard shortcut manager (useKeyboardShortcuts hook)
- [ ] Task 2: Define shortcut map for all views
- [ ] Task 3: Create help modal (? key)
- [ ] Task 4: Write tests + validate

## Dev Notes
### Source Files
- `packages/web/src/hooks/` — new useKeyboardShortcuts hook
- `packages/web/src/components/` — ShortcutHelpModal component

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
