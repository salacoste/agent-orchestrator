---
id: task-22.3
title: 'Fix: zero estimatedDurationMs is misleading when all sessions failed'
status: Done
assignee: []
created_date: '2026-03-24 11:40'
updated_date: '2026-03-24 12:02'
labels:
  - edge-case
  - pre-flight
dependencies: []
parent_task_id: task-22
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `pre-flight-check.ts:71`\n**Trigger:** All matching sessions are failed/blocked, no completed sessions\n**Fix:** Return null or explicit 'unknown' for duration instead of 0\n**Consequence:** estimatedDurationMs of 0 suggests instant completion rather than unknown duration
<!-- SECTION:DESCRIPTION:END -->
