# Story 41.4: Git Hook Installation Command

Status: ready-for-dev

## Story

As a developer using the agent orchestrator,
I want `ao init --hooks` to install a pre-commit hook that tags commit messages,
so that commits made during agent sessions are automatically tagged with story/agent info.

## Acceptance Criteria

1. `ao init --hooks` installs a `prepare-commit-msg` hook in `.git/hooks/`
2. The hook script calls `tagCommitMessage()` from `commit-tag.ts`
3. If hooks already exist, the command warns and does not overwrite
4. `ao init --hooks --force` overwrites existing hooks
5. Tests verify hook installation, existing hook detection, and force overwrite

## Tasks / Subtasks

- [ ] Task 1: Add --hooks flag to init command (AC: #1, #2)
  - [ ] 1.1: Add `--hooks` option to the init command in `init.ts`
  - [ ] 1.2: When `--hooks` is passed, write `prepare-commit-msg` hook script
  - [ ] 1.3: Hook script: shell wrapper that calls `ao hook commit-tag` or inline Node
  - [ ] 1.4: Make hook file executable (chmod +x)
- [ ] Task 2: Handle existing hooks (AC: #3, #4)
  - [ ] 2.1: Check if `.git/hooks/prepare-commit-msg` already exists
  - [ ] 2.2: If exists and no `--force`, warn and exit
  - [ ] 2.3: If `--force`, overwrite with warning
- [ ] Task 3: Write tests (AC: #5)
  - [ ] 3.1: Test hook file is created in .git/hooks/
  - [ ] 3.2: Test existing hook triggers warning without --force
  - [ ] 3.3: Test --force overwrites existing hook
  - [ ] 3.4: Test hook script content references tagCommitMessage

## Dev Notes

### Architecture Constraints

- **`execFile` not `exec`** — CLAUDE.md mandate for shell commands
- **Portable hook script** — use `#!/bin/sh` with node invocation, not bash-specific
- **Hook location** — `.git/hooks/prepare-commit-msg` (not `pre-commit`)
- **`prepare-commit-msg`** receives the commit message file path as $1

### Implementation Approach

The hook script is a small shell script that invokes node to run the tagging:
```sh
#!/bin/sh
# Agent Orchestrator commit tagger (installed by ao init --hooks)
node -e "
  const { tagCommitMessage } = require('@composio/ao-cli/hooks/commit-tag');
  const fs = require('fs');
  const msg = fs.readFileSync(process.argv[1], 'utf-8');
  const tagged = tagCommitMessage(msg, null, null);
  fs.writeFileSync(process.argv[1], tagged);
" "$1"
```

Simpler alternative: write a standalone script that reads/writes the commit message file.

### Files to Modify

1. `packages/cli/src/commands/init.ts` (modify — add --hooks + --force flags)
2. `packages/cli/__tests__/commands/init.test.ts` (modify — add hook tests)

### References

- [Source: packages/cli/src/hooks/commit-tag.ts] — tagCommitMessage function
- [Source: packages/cli/src/commands/init.ts] — existing init command

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
