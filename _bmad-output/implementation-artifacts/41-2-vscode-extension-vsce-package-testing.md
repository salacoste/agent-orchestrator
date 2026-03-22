# Story 41.2: VS Code Extension — vsce Package Testing

Status: review

## Story

As a developer distributing the VS Code extension,
I want the extension to build and package successfully with vsce,
so that users can install the .vsix file in VS Code.

## Acceptance Criteria

1. Extension TypeScript compiles without errors via `tsc`
2. A `package` script produces a .vsix file (or documents the vsce setup)
3. Extension entry point exports `activate` and `deactivate` functions
4. Package.json has required VS Code extension fields (publisher, engines, main, contributes)
5. Tests verify extension structure and exported functions
6. Build issues documented and fixed

## Tasks / Subtasks

- [x] Task 1: Fix build issues and verify compilation (AC: #1, #6)
  - [x] 1.1: Dependencies already present (typescript, @types/vscode)
  - [x] 1.2: tsconfig.json already correct (commonjs output)
  - [x] 1.3: Fixed build script: `pnpm exec tsc` instead of bare `tsc`
  - [x] 1.4: deactivate() already exported (from Cycle 7)
- [x] Task 2: Validate package.json extension manifest (AC: #4)
  - [x] 2.1: Verified publisher, engines.vscode, main, contributes
  - [x] 2.2: Added `repository` field for vsce packaging
  - [x] 2.3: Added vitest devDependency + test script
- [x] Task 3: Write validation tests (AC: #3, #5)
  - [x] 3.1: Test activate/deactivate exports exist
  - [x] 3.2: Test tree providers + commands registered
  - [x] 3.3: Test package.json manifest fields (6 assertions)
- [x] Task 4: Document vsce packaging (AC: #2)
  - [x] 4.1: Package script uses `pnpm exec vsce package --no-dependencies`
  - [x] 4.2: Build verified: `dist/extension.js` produced

## Dev Notes

### Architecture Constraints

- **CommonJS output** — VS Code extensions must use CommonJS (`module.exports`), not ESM
- **No workspace dependencies** — vsce doesn't support pnpm workspace protocol. Extension must be self-contained.
- **`@types/vscode`** — provides VS Code API types without bundling the runtime
- **Build is currently broken** — `pnpm build` fails for vscode-extension because `tsc` isn't in PATH for that package

### Implementation Approach

The extension scaffold exists but has build issues. Fix compilation, add deactivate export, validate manifest, and write structural tests.

For vsce packaging: document the process since vsce requires npm (not pnpm) and a Personal Access Token for publishing. We don't need to actually publish — just verify the structure is correct.

### Files to Modify

1. `packages/vscode-extension/src/extension.ts` (fix — add deactivate, fix types)
2. `packages/vscode-extension/package.json` (fix — add repository, ensure fields)
3. `packages/vscode-extension/tsconfig.json` (verify — CommonJS output)
4. `packages/vscode-extension/src/extension.test.ts` (new — structural tests)

### References

- [Source: packages/vscode-extension/src/extension.ts] — extension scaffold
- [Source: packages/vscode-extension/package.json] — manifest
- [Source: _bmad-output/implementation-artifacts/cycle-7-retrospective.md] — noted build issues

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Completion Notes List

- Fixed build: `pnpm exec tsc` resolves PATH issue
- Added repository field for vsce compatibility
- Added vitest + test script for structural tests
- 10 tests verifying exports, registrations, and manifest fields
- Build produces dist/extension.js successfully

### File List

- packages/vscode-extension/package.json (modified — repository, scripts, vitest)
- packages/vscode-extension/src/extension.test.ts (new — 10 structural tests)
