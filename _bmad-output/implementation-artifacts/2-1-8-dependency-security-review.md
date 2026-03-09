# Story 2.1.8: Dependency Security Review

Status: done

## Story

As a Senior Developer (Charlie),
I want a security review for all dependencies,
so that I know there are no known vulnerabilities or license incompatibilities.

## Acceptance Criteria

1. **Given** dependencies are added to the project
   - Security review completed before merge
   - License compatibility checked
   - Known vulnerabilities scanned
   - Dependency approval process documented

2. **Given** chokidar ^4.0.1 (added in Story 2-6) needs review
   - Security review completed for chokidar
   - License compatibility verified
   - Scan for known vulnerabilities
   - Document approval in dependency review log

3. **Given** dependency approval process exists
   - Checklist for security review
   - License compatibility matrix
   - Vulnerability scanning procedure
   - Approval tracking in sprint status

4. **Given** dependency review is integrated
   - Add dependency review step to story template
   - Add security review to code review checklist
   - Create dependency review documentation
   - Track dependency approvals

## Tasks / Subtasks

- [x] Create dependency security review checklist
  - [x] Define security review criteria
  - [x] Define license compatibility requirements
  - [x] Create vulnerability scanning procedure
  - [x] Create approval tracking template
- [x] Perform security review for chokidar ^4.0.1
  - [x] Check for known vulnerabilities (npm audit, Snyk)
  - [x] Verify license compatibility (MIT)
  - [x] Review chokidar security history
  - [x] Document approval in dependency review log
- [x] Create dependency approval process
  - [x] Define approval workflow
  - [x] Create dependency review template
  - [x] Track dependency approvals in sprint status
- [x] Integrate dependency review into workflows
  - [x] Add dependency review to story template
  - [x] Add security review to code review checklist
  - [x] Create CI check for dependency vulnerabilities
- [x] Document dependency approval process
  - [x] Write dependency security review guide
  - [x] Document license compatibility matrix
  - [x] Add troubleshooting guide for dependency issues

## Dev Notes

### Epic 2 Retrospective Context (ACTION-8)

**Critical Issue Found:**
- New dependency added without planning: chokidar ^4.0.1
- Dependency not in original epic planning
- Security review skipped for new dependency
- License compatibility not checked

**Root Cause:**
- chokidar selected during implementation for file watching capabilities
- No dependency discovery during planning phase
- No systematic security review process

**Impact:**
- Dependency not vetted before adding
- Potential security vulnerabilities
- License compatibility unknown
- No documentation of approval process

**Prevention:**
- Security review for chokidar ^4.0.1 before Epic 4 (Error Handling epic)
- Dependency discovery during planning
- Document dependency approval process

### Technical Requirements

**Dependency Security Review Checklist:**
```markdown
## Dependency Security Review

### Before Adding Dependency
- [ ] Is this dependency necessary? (can existing code be used instead?)
- [ ] Was this dependency considered during planning?
- [ ] Is there an alternative with fewer dependencies?

### Security Review
- [ ] Run `npm audit` to check for known vulnerabilities
- [ ] Check Snyk database for vulnerability history
- [ ] Review GitHub security advisories
- [ ] Check last updated date (stale dependencies are risk)

### License Compatibility
- [ ] Check license type (MIT, Apache-2.0, BSD, etc.)
- [ ] Verify license compatibility with project license
- [ ] Check for copyleft restrictions (GPL, AGPL, etc.)

### Dependency Health
- [ ] Check maintainer responsiveness
- [ ] Review open issues and PRs
- [ ] Check release frequency
- [ ] Verify dependency has tests

### Documentation
- [ ] Document dependency in package.json with comment
- [ ] Add to DEPENDENCIES.md with justification
- [ ] Update sprint-status.yaml with dependency approval
```

**License Compatibility Matrix:**
```markdown
| License    | Compatible | Notes |
|------------|------------|-------|
| MIT        | ✅ Yes     | Permissive, no restrictions |
| Apache-2.0 | ✅ Yes     | Permissive, patent grant |
| BSD-2/3    | ✅ Yes     | Permissive, attribution required |
| ISC        | ✅ Yes     | Permissive, similar to MIT |
| GPL-2/3    | ❌ No      | Copyleft, requires source disclosure |
| AGPL-3     | ❌ No      | Copyleft, network use requires source |
| LGPL-2.1   | ⚠️ Maybe   | Lesser GPL, dynamic linking OK |
```

**Dependency Review Template:**
```markdown
## Dependency Review: chokidar ^4.0.1

**Date:** 2026-03-09
**Added in:** Story 2-6 (YAML File Watcher)
**Requested by:** Development implementation

### Security Review
- [ ] npm audit: No known vulnerabilities
- [ ] Snyk scan: No critical/high vulnerabilities
- [ ] GitHub advisories: No open security issues
- [ ] Last updated: Recently (within 6 months)

### License Review
- License: MIT
- Compatible: ✅ Yes
- Link: https://github.com/paulmillr/chokidar/blob/main/LICENSE

### Dependency Health
- Maintainer: Active
- Open issues: Reviewed, no critical security issues
- Release frequency: Regular releases
- Test coverage: Good
- Weekly downloads: High (widely used)

### Alternatives Considered
- Native fs.watch(): Too many platform differences
- watchpack: Heavy dependency (webpack)
- gaze: Inactive project

### Approval
- [ ] Security review passed
- [ ] License compatible
- [ ] Documented in DEPENDENCIES.md
- [ ] Added to sprint-status.yaml
```

**CI Check for Dependencies:**
```yaml
# .github/workflows/dependency-audit.yml
name: Dependency Audit

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: pnpm install
      - run: pnpm audit
      - name: Check for vulnerabilities
        run: |
          if pnpm audit --json | grep -q '"vulnerabilities"'; then
            echo "❌ Security vulnerabilities found!"
            exit 1
          fi
```

### Architecture Compliance

**From project-context.md (Security Rules):**
- All dependencies must be continuously monitored for vulnerabilities
- Validate external data from API/CLI/file inputs
- Security first — no compromise on security fundamentals

**From Epic 2 Retrospective:**
- Dependency discovery during planning phase
- Security review before adding dependencies
- Document dependency approval process

### File Structure Requirements

**New Files to Create:**
```
.bmad/
└── docs/
    ├── DEPENDENCY_SECURITY_REVIEW.md   # Security review guide
    └── DEPENDENCIES.md                  # Approved dependencies log

_bmad-output/
└── implementation-artifacts/
    └── dependency-reviews/              # Individual dependency reviews
        └── chokidar-4.0.1.md             # chokidar review
```

**Sprint Status Enhancement:**
```yaml
# sprint-status.yaml
dependencies:
  chokidar:
    version: "4.0.1"
    license: MIT
    approved: true
    reviewedAt: "2026-03-09"
    reviewLink: "_bmad-output/implementation-artifacts/dependency-reviews/chokidar-4.0.1.md"
```

### Library/Framework Requirements

**Tools for Dependency Review:**
- `npm audit` - Built-in vulnerability scanner
- `pnpm audit` - pnpm-specific vulnerability scanner
- `snyk` - Third-party vulnerability scanning (optional)
- `license-checker` - License compatibility checker (optional)
- `npm-check-updates` - Check for dependency updates (optional)

### Testing Standards

**Dependency Review Testing:**
- CI check runs `pnpm audit` on every PR
- Fails if vulnerabilities found
- Weekly automated audit runs
- Manual review for new dependencies

**License Compliance Testing:**
- Check license compatibility before adding
- Document license in DEPENDENCIES.md
- Track license types in sprint status

### Project Structure Notes

**Alignment with Unified Project Structure:**
- Add dependency review documentation to `.bmad/docs/`
- Track dependency approvals in sprint status
- Integrate review into existing workflows

**Detected Conflicts or Variances:**
- None detected — this is a new process

### References

- [Source: _bmad-output/retrospectives/epic-2-retrospective.md] ACTION-8: Dependency Security Review
- [Source: _bmad-output/implementation-artifacts/2-6-yaml-file-watcher.md] Story 2-6 where chokidar was added
- [Source: _bmad-output/project-context.md] Security Rules section
- [Source: packages/core/package.json] Current dependencies
- [Source: https://github.com/paulmillr/chokidar] chokidar repository
- [Source: https://github.com/paulmillr/chokidar/blob/main/LICENSE] chokidar license (MIT)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None — documentation and process implementation.

### Completion Notes List

1. ✅ Created dependency security review checklist with criteria and license matrix
2. ✅ Performed security reviews for all existing dependencies (chokidar, proper-lockfile, yaml, zod)
3. ✅ Created dependency approval process with workflow and tracking
4. ✅ Integrated dependency review into story template and code review workflow
5. ✅ CI dependency audit already exists in .github/workflows/security.yml

### File List

**Created:**
- `_bmad/docs/DEPENDENCIES.md` - Approved dependencies log
- `_bmad/docs/dependency-security-review-checklist.md` - Security review checklist
- `_bmad/docs/dependency-reviews/chokidar-4.0.3.md` - chokidar security review
- `_bmad/docs/dependency-reviews/proper-lockfile-4.1.2.md` - proper-lockfile security review
- `_bmad/docs/dependency-reviews/yaml-2.8.2.md` - yaml security review
- `_bmad/docs/dependency-reviews/zod-3.25.76.md` - zod security review

**Modified:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Added dependencies section
- `_bmad/bmm/workflows/4-implementation/create-story/template.md` - Added Dependency Review section
- `_bmad/bmm/workflows/4-implementation/code-review/instructions.xml` - Added dependency security review step
