---
id: task-20.2
title: 'Fix: invalid requestedAt timestamp makes approval never expire'
status: Done
assignee: []
created_date: '2026-03-24 11:39'
updated_date: '2026-03-24 12:02'
labels:
  - edge-case
  - approval-service
dependencies: []
parent_task_id: task-20
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `approval-service.ts:64`\n**Trigger:** requestedAt is invalid ISO string, getTime() returns NaN\n**Fix:** `const reqTime = new Date(approval.requestedAt).getTime(); if (isNaN(reqTime)) continue;`\n**Consequence:** NaN arithmetic means timed-out approval never gets expired
<!-- SECTION:DESCRIPTION:END -->
