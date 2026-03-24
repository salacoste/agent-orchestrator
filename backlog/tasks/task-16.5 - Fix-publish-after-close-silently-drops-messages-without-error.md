---
id: task-16.5
title: 'Fix: publish after close silently drops messages without error'
status: To Do
assignee: []
created_date: '2026-03-24 11:37'
labels:
  - edge-case
  - message-bus
dependencies: []
parent_task_id: task-16
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `message-bus.ts:64`\n**Trigger:** Publish called after close() returns immediately without error\n**Fix:** `if (closed) throw new Error('Bus is closed');` or return a result indicating failure\n**Consequence:** Caller silently loses messages with no indication delivery failed
<!-- SECTION:DESCRIPTION:END -->
