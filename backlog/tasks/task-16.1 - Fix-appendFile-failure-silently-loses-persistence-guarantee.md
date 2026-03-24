---
id: task-16.1
title: 'Fix: appendFile failure silently loses persistence guarantee'
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
**File:** `message-bus.ts:78`\n**Trigger:** appendFile fails (disk full), publish silently loses persistence\n**Fix:** Deliver message but re-throw error so caller knows persistence failed\n**Consequence:** Message delivered to subscribers but not persisted; replay will miss it
<!-- SECTION:DESCRIPTION:END -->
