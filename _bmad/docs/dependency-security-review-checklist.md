# Dependency Security Review Checklist

This checklist is used before adding or updating dependencies to the Agent Orchestrator project.

## Review Process

### 1. Pre-Add Review

Before adding a new dependency:

- [ ] Check npmjs.com for package reputation and maintenance status
- [ ] Verify the package has not been deprecated
- [ ] Check for known vulnerabilities using `pnpm audit`
- [ ] Review license compatibility (see License Matrix below)
- [ ] Evaluate package size and tree depth
- [ ] Check for alternative packages that could achieve the same goal

### 2. Security Scan

Run the following commands:

```bash
# Check for vulnerabilities
pnpm audit --json

# Check for outdated packages
pnpm outdated

# Check license info
npx license-checker # optional, for detailed license analysis
```

### 3. License Compatibility Matrix

| License Type | Compatible | Notes |
|-------------|-----------|-------|
| MIT | ✅ Yes | Fully compatible |
| Apache-2.0 | ✅ Yes | Compatible with MIT |
| ISC | ✅ Yes | Compatible with MIT |
| BSD-2-Clause | ✅ Yes | Compatible with MIT |
| BSD-3-Clause | ✅ Yes | Compatible with MIT |
| 0BSD | ✅ Yes | Compatible with MIT |
| GPL-2.0 | ⚠️ Review | Copyleft - requires source disclosure |
| GPL-3.0 | ⚠️ Review | Strong copyleft - requires source disclosure |
| AGPL-3.0 | ❌ No | Network copyleft - not compatible with MIT |
| LGPL-2.1 | ✅ Yes | Weak copyleft - compatible with MIT |
| LGPL-3.0 | ✅ Yes | Weak copyleft - compatible with MIT |
| MPL-2.0 | ⚠️ Review | Mozilla Public License - review terms |
| Unlicense | ✅ Yes | Public domain |
| Custom | ⚠️ Review | Requires legal review |

### 4. Approval Criteria

A dependency is approved if:

1. **No Critical/High Vulnerabilities**: Must have no critical or high severity vulnerabilities
2. **License Compatible**: License must be compatible with MIT (project license)
3. **Actively Maintained**: Package should have recent commits (within 1 year)
4. **Reasonable Size**: Package size and dependency tree should be reasonable
5. **Trusted Source**: Package should be from a reputable source (verified publisher, high downloads)

### 5. Post-Add Monitoring

After adding a dependency:

- [ ] Add to DEPENDENCIES.md (if it's a core dependency)
- [ ] Update sprint-status.yaml with dependency approval status
- [ ] Run weekly security audits in CI

## Current Dependencies Status

| Package | Version | License | Status | Last Reviewed |
|---------|---------|---------|--------|---------------|
| chokidar | ^4.0.1 | MIT | ✅ Approved | 2026-03-09 |
| proper-lockfile | ^4.1.2 | MIT | ✅ Approved | 2026-03-09 |
| yaml | ^2.7.0 | ISC | ✅ Approved | 2026-03-09 |
| zod | ^3.24.0 | MIT | ✅ Approved | 2026-03-09 |

## Weekly Security Audit

The CI pipeline should run:

```yaml
# .github/workflows/security-audit.yml
name: Security Audit
on:
  schedule:
    - cron: '0 0 * * 1'  # Every Monday at midnight UTC
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: pnpm/action-setup@v2
      - name: Run security audit
        run: pnpm audit --audit-level=moderate
```

## Troubleshooting

### Vulnerability Found

1. Check if there's an updated version: `pnpm update [package-name]`
2. Check if vulnerability affects your use case
3. If no fix available, consider alternatives
4. Document any accepted risk in DEPENDENCIES.md

### License Incompatibility

1. Check for MIT/Apache-2.0 licensed alternatives
2. Consider forking and relicensing if critical
3. Document any exceptions in sprint-status.yaml

### Deprecated Package

1. Check deprecation reason in package docs
2. Evaluate alternatives
3. Plan migration timeline if critical
