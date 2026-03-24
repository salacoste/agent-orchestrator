---
id: task-15.1
title: >-
  Fix: ensureInitialized race — concurrent calls see initialized=true but stale
  lastHash
status: Done
assignee: []
created_date: '2026-03-24 11:37'
updated_date: '2026-03-24 11:50'
labels:
  - edge-case
  - audit-log
  - race-condition
dependencies: []
parent_task_id: task-15
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `immutable-audit-log.ts:112`\n**Trigger:** ensureInitialized sets initialized=true before async readFile completes\n**Fix:** Use mutex or move initialized=true after try/catch\n**Consequence:** Concurrent calls during init see initialized=true but lastHash still GENESIS
<!-- SECTION:DESCRIPTION:END -->
