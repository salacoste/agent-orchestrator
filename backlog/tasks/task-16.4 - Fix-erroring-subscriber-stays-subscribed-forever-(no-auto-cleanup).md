---
id: task-16.4
title: 'Fix: erroring subscriber stays subscribed forever (no auto-cleanup)'
status: Done
assignee: []
created_date: '2026-03-24 11:37'
updated_date: '2026-03-24 12:01'
labels:
  - edge-case
  - message-bus
dependencies: []
parent_task_id: task-16
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `message-bus.ts:53`\n**Trigger:** Subscriber throws on every message delivery\n**Fix:** Track error count per subscriber, auto-unsubscribe after N consecutive failures\n**Consequence:** Broken subscriber keeps receiving and throwing on every publish
<!-- SECTION:DESCRIPTION:END -->
