---
id: task-21.1
title: 'Fix: config.total NaN disables total limit silently'
status: Done
assignee: []
created_date: '2026-03-24 11:40'
updated_date: '2026-03-24 12:02'
labels:
  - edge-case
  - resource-pool
  - security
dependencies: []
parent_task_id: task-21
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `resource-pool.ts:81`\n**Trigger:** config.total is NaN (NaN >= NaN is false)\n**Fix:** `if (!Number.isFinite(config.total)) throw new Error('Invalid total');`\n**Consequence:** NaN total effectively disables total limit, allowing unlimited spawns
<!-- SECTION:DESCRIPTION:END -->
