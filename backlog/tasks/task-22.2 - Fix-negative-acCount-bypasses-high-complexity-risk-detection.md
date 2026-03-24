---
id: task-22.2
title: 'Fix: negative acCount bypasses high-complexity risk detection'
status: Done
assignee: []
created_date: '2026-03-24 11:40'
updated_date: '2026-03-24 12:02'
labels:
  - edge-case
  - pre-flight
dependencies: []
parent_task_id: task-22
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `pre-flight-check.ts:48`\n**Trigger:** acCount is negative number\n**Fix:** `const safeAcCount = Math.max(0, acCount);`\n**Consequence:** Negative AC count bypasses high-complexity risk factor when it should flag invalid input
<!-- SECTION:DESCRIPTION:END -->
