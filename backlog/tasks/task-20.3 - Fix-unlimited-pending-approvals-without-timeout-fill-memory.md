---
id: task-20.3
title: 'Fix: unlimited pending approvals without timeout fill memory'
status: Done
assignee: []
created_date: '2026-03-24 11:39'
updated_date: '2026-03-24 12:02'
labels:
  - edge-case
  - approval-service
  - memory
dependencies: []
parent_task_id: task-20
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `approval-service.ts:92`\n**Trigger:** Unlimited approval requests without timeout accumulate in Map\n**Fix:** `if (approvals.size > MAX_RESOLVED * 2) pruneResolved();` — prune on request too\n**Consequence:** Memory leak from accumulating pending approvals that never resolve
<!-- SECTION:DESCRIPTION:END -->
