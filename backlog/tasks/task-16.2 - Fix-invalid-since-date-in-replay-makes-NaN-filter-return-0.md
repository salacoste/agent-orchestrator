---
id: task-16.2
title: 'Fix: invalid since date in replay makes NaN filter return 0'
status: Done
assignee: []
created_date: '2026-03-24 11:37'
updated_date: '2026-03-24 12:01'
labels:
  - edge-case
  - message-bus
dependencies: []
parent_task_id: task-16
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `message-bus.ts:111`\n**Trigger:** since is invalid date string like 'not-a-date'\n**Fix:** `if (isNaN(sinceMs)) return 0;`\n**Consequence:** NaN comparison means no messages pass filter, replay returns 0 silently
<!-- SECTION:DESCRIPTION:END -->
