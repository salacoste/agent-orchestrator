---
id: task-15.6
title: 'Fix: verify() skips malformed lines, reports broken chain at wrong index'
status: To Do
assignee: []
created_date: '2026-03-24 11:37'
labels:
  - edge-case
  - audit-log
dependencies: []
parent_task_id: task-15
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `immutable-audit-log.ts:204`\n**Trigger:** verify() calls readEntries() which skips malformed lines\n**Fix:** Use raw line parsing that preserves line indices for accurate brokenAt reporting\n**Consequence:** Skipped malformed lines create gaps; verify sees chain break at wrong index
<!-- SECTION:DESCRIPTION:END -->
