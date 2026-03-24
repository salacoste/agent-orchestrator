---
id: task-22.4
title: 'Fix: zero/negative durationMs in completed sessions skews average'
status: To Do
assignee: []
created_date: '2026-03-24 11:40'
labels:
  - edge-case
  - pre-flight
dependencies: []
parent_task_id: task-22
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `pre-flight-check.ts:76`\n**Trigger:** Completed sessions have durationMs of 0 or negative\n**Fix:** `const valid = completedSessions.filter(l => l.durationMs > 0);`\n**Consequence:** Zero/negative durations drag average down, producing unrealistically low estimate
<!-- SECTION:DESCRIPTION:END -->
