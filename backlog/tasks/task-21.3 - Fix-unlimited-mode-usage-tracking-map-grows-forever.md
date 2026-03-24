---
id: task-21.3
title: 'Fix: unlimited mode usage tracking map grows forever'
status: Done
assignee: []
created_date: '2026-03-24 11:40'
updated_date: '2026-03-24 12:02'
labels:
  - edge-case
  - resource-pool
  - memory
dependencies: []
parent_task_id: task-21
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `resource-pool.ts:69`\n**Trigger:** Acquire without config tracks usage but never prunes\n**Fix:** Cap map size or periodically prune zero-usage entries\n**Consequence:** Unbounded usage tracking map grows forever in long-running unlimited mode
<!-- SECTION:DESCRIPTION:END -->
