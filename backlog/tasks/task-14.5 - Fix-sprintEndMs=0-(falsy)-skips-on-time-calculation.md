---
id: task-14.5
title: 'Fix: sprintEndMs=0 (falsy) skips on-time calculation'
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
**File:** `sprint-simulator.ts:124`\n**Trigger:** sprintEndMs is 0 (falsy), skips on-time calculation\n**Fix:** `if (sprintEndMs !== undefined) {` instead of `if (sprintEndMs) {`\n**Consequence:** Sprint end of epoch 0 treated as no deadline, returns 100% on-time
<!-- SECTION:DESCRIPTION:END -->
