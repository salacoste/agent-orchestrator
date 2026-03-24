---
id: task-15.4
title: 'Fix: invalid since date string makes NaN filter out all entries'
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
**File:** `immutable-audit-log.ts:191`\n**Trigger:** options.since is an invalid date string like 'garbage'\n**Fix:** `const sinceMs = new Date(options.since).getTime(); if (isNaN(sinceMs)) return entries;`\n**Consequence:** NaN comparison returns false for all entries, silently returns empty array
<!-- SECTION:DESCRIPTION:END -->
