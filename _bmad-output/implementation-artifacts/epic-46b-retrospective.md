# Epic 46b Retrospective — Team Features

**Date**: 2026-04-29
**Epic**: 46b — Team Features
**Status**: Complete (all 4 stories done)
**Source**: epics-cycle-9.md (Phase 2, depends on Epic 46a)
**Cycle**: 9 — Autonomy, Scale & Frontier

## Epic Summary

Epic 46b delivered the multi-user team layer: config-based user identity with role hierarchy, approval workflows that gate risky operations behind human review, shared resource pools with per-project capacity limits, and configurable agent isolation levels. All four stories build on the infrastructure from Epic 46a — user identity feeds the audit log, approval workflows log decisions to the audit trail, resource pools integrate with the spawn queue from Story 43.3, and isolation levels define declarative policies for agent sandboxing.

The epic introduces the team model: no passwords, no tokens, no login page. Identity is declared in config and selected via dropdown. This trust-based approach targets small teams (5-15 people) rather than enterprise SSO scenarios.

## Story Delivery

| Story | Title | Status | Tests Added | Review Issues | Files Created/Modified |
|-------|-------|--------|-------------|---------------|----------------------|
| 46b-1 | Auth — Config-Based User Identity | Done | 16 (13 core + 3 route) | 0 (clean) | 7 files (5 new, 2 modified) |
| 46b-2 | Approval Workflows — Human Gates | Done | Pending story completion notes | Pending | 6 files planned (new), 2 modified |
| 46b-3 | Resource Pool — Shared Agent Capacity | Done | Pending story completion notes | Pending | 4 files planned (new), 2 modified |
| 46b-4 | Agent Isolation Levels | Done | Pending story completion notes | Pending | 2 files planned (new), 2 modified |

**Note**: Stories 46b-2, 46b-3, and 46b-4 are marked "done" in their story files but the Dev Agent Record sections contain placeholder template values (`{{agent_model_name_version}}`) rather than completed notes. Test counts and file lists are based on planned artifacts from the story specifications.

**New modules**: user-identity.ts, approval-service.ts, resource-pool.ts, isolation-levels.ts
**External dependencies added**: 0
**New config sections**: `users`, `approvalRequired`, `resourcePool`, `isolation`

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — project vision, priorities, user outcomes
- Nova (Architect) — system design, interfaces, extensibility
- Blaze (Dev) — implementation, patterns, pain points
- Pax (QA) — test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** The trust-based identity model is the right call for the target audience. Small teams running AI coding agents do not need OAuth flows — they need a dropdown that says "I am Alice" so that audit logs and approval workflows attribute actions correctly. The role hierarchy (admin > lead > dev > viewer) is simple enough to reason about and extensible enough for future permission granularity. Combined with approval workflows, we now have a system where a lead can configure "spawns require my approval" and the orchestrator enforces it without adding friction to routine operations.

**Nova (Architect):** Four architectural patterns that worked well together:

1. **Config-declared identity** — The `users` array in `agent-orchestrator.yaml` with Zod-validated fields (id, name, role enum, optional email) follows the existing config pattern perfectly. No new infrastructure needed. The `resolveUser()` pure function maps header values to `ConfigUser` objects, with `ANONYMOUS_USER` as the safe default. This is identity without authentication — exactly what was specified.

2. **In-memory approval queue** — Approvals live in memory and reset on restart. This is explicitly v1 behavior and documented as acceptable. The approval service is a simple state machine: pending -> approved/rejected, with optional timeout for auto-approve. The `requestApproval()` -> `approve(id, approvedBy)` flow is clean and audit-friendly.

3. **Declarative isolation policies** — The `resolveIsolation()` function returns an `IsolationPolicy` with four boolean flags (ownWorktree, gitPushAllowed, networkAccess, crossProjectAccess). Three levels (shared, isolated, quarantined) map to three different permission sets. This is policy-as-data, not enforcement-in-code — the right split for v1 where enforcement is future work.

4. **Resource pool as a capacity gate** — The pool manager checks capacity before spawn, integrates with the existing spawn queue from Story 43.3, and exposes state via `GET /api/resources`. When no `resourcePool` is configured, all checks return true (unlimited). This opt-in design means the feature does not affect existing users.

**Blaze (Dev):** The `hasPermission(role, required)` function from 46b-1 is a clean implementation of the role hierarchy. It uses a simple precedence check (admin > lead > dev > viewer) rather than a bitfield or ACL system. For the current scale (4 roles, no custom permissions), this is the right complexity level. The `useUserIdentity` React hook follows the existing `useUserRole` pattern — localStorage key, fetch on mount with AbortController, state management. Consistency with existing patterns means less cognitive overhead.

**Pax (QA):** Story 46b-1 has 16 new tests covering config schema validation (4 tests), user resolution (4 tests), API route behavior (3 tests), and permission hierarchy (5 tests). The permission tests cover all five cross-role comparisons, which is thorough for a 4-role hierarchy. The route tests include the "service failure" case, which tests the non-fatal error path — this is the pattern established in earlier epics and it is good to see it continued.

---

### What Could Be Improved

**R2d2 (Project Lead):** Stories 46b-2, 46b-3, and 46b-4 are marked "done" but their Dev Agent Records contain unexpanded template variables (`{{agent_model_name_version}}`) and empty completion notes. This means the stories were completed without the standard documentation pass. The implementations may be correct, but the audit trail is incomplete. Future sprints should enforce that "done" status requires filled-in completion notes and file lists.

**Nova (Architect):** The approval service is in-memory with no persistence. If the orchestrator restarts while approvals are pending, those approvals are lost. This is documented as acceptable v1 behavior, but it creates a gap: the audit log (from 46a-1) records completed actions, but pending approvals exist only in memory. An operator approving a spawn after a restart would not know there was a pending approval that was lost. A lightweight JSONL file for pending approvals would close this gap without adding complexity.

**Blaze (Dev):** The isolation levels (46b-4) are purely declarative — `resolveIsolation()` returns a policy but nothing enforces it. The story is explicit about this: "this story defines policy, enforcement is future." But the policy flags (`ownWorktree`, `gitPushAllowed`, `networkAccess`, `crossProjectAccess`) have no consumers yet. The runtime, workspace, and agent plugins would need to read these policies and enforce them. Until that wiring happens, isolation levels are documentation, not security boundaries. This should be clearly surfaced to users.

**Pax (QA):** The resource pool (46b-3) has a planned test suite (per-project limits, total pool limit, acquire/release flow, unlimited fallback, API route) but the completion notes are empty. Without seeing actual test output, it is hard to verify coverage. The plan looks comprehensive — the question is whether implementation matched the plan. The approval service (46b-2) similarly has planned tests but no completion notes.

---

### Key Decisions

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| Config-based identity (no passwords) | Small teams trust each other; dropdown selection is sufficient | OAuth, JWT, session-based auth |
| In-memory approval queue (resets on restart) | Acceptable v1 trade-off; approvals are ephemeral decisions | JSONL persistence for pending approvals |
| ANONYMOUS_USER defaults to admin role | Backward compatibility — existing single-user setups continue working | Default to viewer (least privilege) |
| Role hierarchy: admin > lead > dev > viewer | Simple, covers common team structures | ACL system, bitfield permissions |
| Resource pool is opt-in (unlimited when unconfigured) | Zero impact on existing users | Mandatory pool configuration |
| Isolation levels are declarative (no runtime enforcement) | v1 defines policy; enforcement requires plugin changes across runtime, workspace, agent | Enforce immediately via workspace plugins |
| Approval workflow is backend-only (no dashboard UI) | UI is a separate story; backend is the foundation | Full-stack story including UI |

---

### Lessons Learned

1. **Trust-based identity is a feature, not a limitation** — For teams of 5-15 people running AI coding agents, config-declared identity with a dropdown is the correct abstraction. Adding OAuth would be solving a problem the target users do not have. The system can always add authentication layers later without changing the identity model.

2. **Declarative policy without enforcement is a valid milestone** — Isolation levels define what *should* happen without making it happen. This separates the policy question ("what should quarantine mean?") from the enforcement question ("how does the runtime enforce it?"). Answering policy first prevents building enforcement for the wrong policy.

3. **Opt-in features with zero-impact defaults reduce risk** — Both `resourcePool` and `approvalRequired` default to empty/unconfigured, meaning existing setups continue working identically. This is the config-gated feature pattern at work: new capabilities that activate only when explicitly configured.

4. **Dev Agent Record completeness matters for retrospectives** — Stories 46b-2 through 46b-4 have empty completion notes, which makes it harder to verify what was actually delivered versus what was planned. The template variables should be filled in before marking stories as done.

---

## Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Fill in Dev Agent Record for stories 46b-2, 46b-3, 46b-4 (completion notes + file lists) | Dev | MEDIUM |
| 2 | Wire isolation policy enforcement into runtime/workspace plugins | Dev | MEDIUM |
| 3 | Add JSONL persistence for pending approvals (survive restart) | Dev | LOW |
| 4 | Add approval workflow dashboard UI (pending queue, approve/reject buttons) | Dev | LOW |
| 5 | Surface isolation level on agent session cards in dashboard | Dev | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 4 |
| Stories with verified completion notes | 1 (46b-1) |
| Stories with template-only records | 3 (46b-2, 46b-3, 46b-4) |
| New config sections | 4 (users, approvalRequired, resourcePool, isolation) |
| New core modules | 4 (user-identity, approval-service, resource-pool, isolation-levels) |
| New API routes | 6 (users, approvals, approvals/{id}/approve, approvals/{id}/reject, resources, agent/{id} isolation) |
| External dependencies added | 0 |
| Epic duration | ~2 days |
| Phase | Cycle 9, Phase 2 (depends on 46a) |

## Cycle 9 Context

Epic 46b is Phase 2 of Cycle 9, building on Epic 46a infrastructure:

- **Uses from 46a**: Audit log for approval workflow logging and user attribution; config schema patterns for new config sections
- **Enables downstream**: Isolation policies feed into Epic 47 agent sandbox (47.2); approval workflows enable supervised autopilot mode (43.1); resource pools constrain spawn queue (43.3)
- **Cross-epic dependencies**: Approval workflows should integrate with autopilot's supervised mode (43.1) where spawns require approval; resource pool checks should happen before queue insertion in the spawn queue (43.3)
