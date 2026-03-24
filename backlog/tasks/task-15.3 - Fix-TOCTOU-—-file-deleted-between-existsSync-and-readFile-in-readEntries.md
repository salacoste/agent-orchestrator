---
id: task-15.3
title: 'Fix: TOCTOU — file deleted between existsSync and readFile in readEntries'
status: To Do
assignee: []
created_date: '2026-03-24 11:37'
labels:
  - edge-case
  - audit-log
  - crash
dependencies: []
parent_task_id: task-15
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `immutable-audit-log.ts:175`\n**Trigger:** File deleted between existsSync check and readFile call\n**Fix:** `try { await readFile(...); } catch { return []; }` — wrap readFile in try/catch\n**Consequence:** ENOENT exception propagates unhandled to caller
<!-- SECTION:DESCRIPTION:END -->
