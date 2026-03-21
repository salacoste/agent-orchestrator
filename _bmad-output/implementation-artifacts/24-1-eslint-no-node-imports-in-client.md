# Story 24.1: ESLint No-Node-Imports-In-Client Rule

Status: done

## Story

As a **developer**,
I want an ESLint rule that errors when `node:*` modules are imported in client-side files,
So that the Next.js bundling issue from Cycle 4 (Stories 16.1, 18.4) never recurs.

## Acceptance Criteria

1. **AC1: ESLint rule configured**
   - **Given** the web package ESLint config
   - **When** a file in `src/components/` or `src/app/` imports from `node:fs`, `node:path`, or any `node:*` module
   - **Then** ESLint reports an error
   - **And** the rule does NOT flag files in `src/lib/` or `src/app/api/` (server-side paths)

2. **AC2: Existing code passes**
   - **Given** the current codebase
   - **When** `pnpm lint` runs
   - **Then** zero new ESLint errors (all node imports are already in server-side paths)

3. **AC3: Rule documented**
   - **Given** a new contributor
   - **When** they read the ESLint config
   - **Then** the rule has a comment explaining WHY (Next.js bundles node:fs from client imports)

## Tasks / Subtasks

- [ ] Task 1: Add ESLint `no-restricted-imports` rule for `node:*` in client paths
- [ ] Task 2: Configure path-based override (only client components, not API routes)
- [ ] Task 3: Verify `pnpm lint` passes with zero new errors
- [ ] Task 4: Add explanatory comment in ESLint config

## Dev Notes

### Implementation: Use `no-restricted-imports` with overrides

```javascript
// In packages/web/.eslintrc or eslint config
{
  overrides: [
    {
      files: ["src/components/**", "src/app/**/page.tsx", "src/app/**/layout.tsx"],
      rules: {
        "no-restricted-imports": ["error", {
          patterns: [{ group: ["node:*"], message: "Node.js builtins cannot be imported in client components (breaks Next.js bundle). Use server-side API routes instead." }]
        }]
      }
    }
  ]
}
```

### Source Files
- `packages/web/eslint.config.mjs` or equivalent ESLint config file

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
