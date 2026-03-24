---
id: task-21.2
title: 'Fix: config.total=0 silently blocks all spawns with no diagnostic'
status: Done
assignee: []
created_date: '2026-03-24 11:40'
updated_date: '2026-03-24 12:02'
labels:
  - edge-case
  - resource-pool
dependencies: []
parent_task_id: task-21
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `resource-pool.ts:62`\n**Trigger:** config.total is 0, getTotalUsage() >= 0 is always true\n**Fix:** Validate at creation time or document that 0 means no agents allowed\n**Consequence:** Zero total config silently prevents all spawns with no diagnostic message
<!-- SECTION:DESCRIPTION:END -->
