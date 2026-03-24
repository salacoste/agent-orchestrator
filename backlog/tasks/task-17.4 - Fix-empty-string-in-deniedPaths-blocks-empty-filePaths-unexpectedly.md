---
id: task-17.4
title: 'Fix: empty string in deniedPaths blocks empty filePaths unexpectedly'
status: To Do
assignee: []
created_date: '2026-03-24 11:38'
labels:
  - edge-case
  - sandbox
dependencies: []
parent_task_id: task-17
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `agent-sandbox.ts:54`\n**Trigger:** deniedPaths contains empty string\n**Fix:** `config.deniedPaths.filter(Boolean)` before iterating\n**Consequence:** Empty pattern becomes /^$/ regex, may block empty string paths
<!-- SECTION:DESCRIPTION:END -->
