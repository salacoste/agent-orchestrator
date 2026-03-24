---
id: task-15.2
title: 'Fix: appendFile failure leaves lastHash stale via writeChain.catch'
status: Done
assignee: []
created_date: '2026-03-24 11:37'
updated_date: '2026-03-24 11:50'
labels:
  - edge-case
  - audit-log
  - data-corruption
dependencies: []
parent_task_id: task-15
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `immutable-audit-log.ts:158`\n**Trigger:** appendFile fails (disk full, permission denied)\n**Fix:** Ensure lastHash not updated on failure; writeChain.catch should revert or track error state\n**Consequence:** Next entry chains from stale hash, corrupting the chain
<!-- SECTION:DESCRIPTION:END -->
