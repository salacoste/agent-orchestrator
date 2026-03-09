# Approved Dependencies

This document tracks all dependencies approved for use in the Agent Orchestrator project.

## Dependency Approval Process

All dependencies must go through the security review process before being added to the project. See [dependency-security-review-checklist.md](./dependency-security-review-checklist.md) for details.

## Approved Dependencies

| Package | Version | License | Added In | Review Date | Status |
|---------|---------|---------|----------|-------------|--------|
| chokidar | ^4.0.3 | MIT | Story 2-6 | 2026-03-09 | ✅ Approved |
| proper-lockfile | ^4.1.2 | MIT | Story 2-1-7 | 2026-03-09 | ✅ Approved |
| yaml | ^2.8.2 | ISC | Story 2-5 | 2026-03-09 | ✅ Approved |
| zod | ^3.25.76 | MIT | Story 2-1-1 | 2026-03-09 | ✅ Approved |

## Detailed Reviews

Individual dependency reviews are stored in `_bmad/docs/dependency-reviews/`:

- [chokidar-4.0.3.md](./dependency-reviews/chokidar-4.0.3.md)
- [proper-lockfile-4.1.2.md](./dependency-reviews/proper-lockfile-4.1.2.md)
- [yaml-2.8.2.md](./dependency-reviews/yaml-2.8.2.md)
- [zod-3.25.76.md](./dependency-reviews/zod-3.25.76.md)

## Adding New Dependencies

1. **Before adding**: Run through the [Dependency Security Review Checklist](./dependency-security-review-checklist.md)
2. **During implementation**: Document the dependency in this file
3. **After implementation**: Create a review document in `_bmad/docs/dependency-reviews/`
4. **Track in sprint**: Update `sprint-status.yaml` with dependency approval status

## Vulnerability Monitoring

Dependencies are monitored via:
- CI pipeline runs `pnpm audit` on every PR
- Weekly automated vulnerability scans
- Manual review for new dependencies

If vulnerabilities are found:
1. Check if update is available
2. Test update in isolation
3. Apply update with proper testing
4. Document in sprint status

## License Compatibility

See [dependency-security-review-checklist.md](./dependency-security-review-checklist.md) for the full license compatibility matrix.

**Compatible Licenses**: MIT, Apache-2.0, BSD-2/3, ISC
**Incompatible Licenses**: GPL-2/3, AGPL-3
**Review Required**: LGPL-2.1
