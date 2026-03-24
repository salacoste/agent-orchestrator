---
id: task-20.1
title: 'Fix: self-approval — requester can approve their own action'
status: Done
assignee: []
created_date: '2026-03-24 11:39'
updated_date: '2026-03-24 12:02'
labels:
  - edge-case
  - approval-service
  - security
dependencies: []
parent_task_id: task-20
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `approval-service.ts:106`\n**Trigger:** approvedBy equals requestedBy on same approval\n**Fix:** `if (approvedBy === approval.requestedBy) return { success: false, error: 'Self-approval not allowed' };`\n**Consequence:** No separation of duties; requester can approve their own risky action
<!-- SECTION:DESCRIPTION:END -->
