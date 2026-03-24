---
id: task-14.1
title: 'Fix: durationMs of 0 or negative produces unrealistic estimates'
status: To Do
assignee: []
created_date: '2026-03-24 11:36'
labels:
  - edge-case
  - sprint-simulator
dependencies: []
parent_task_id: task-14
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `sprint-simulator.ts:110`\n**Trigger:** SessionLearning with durationMs of 0 or negative value\n**Fix:** `const dur = matches[idx].durationMs; totalMs += dur > 0 ? dur : defaultDurationMs;`\n**Consequence:** Zero/negative durations produce unrealistically optimistic sprint estimates
<!-- SECTION:DESCRIPTION:END -->
