---
id: task-16.6
title: 'Fix: large JSONL file read entirely into memory on replay'
status: Done
assignee: []
created_date: '2026-03-24 11:38'
updated_date: '2026-03-24 12:01'
labels:
  - edge-case
  - message-bus
  - performance
dependencies: []
parent_task_id: task-16
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `message-bus.ts:108`\n**Trigger:** Very large JSONL file read entirely into memory\n**Fix:** Use readline or streaming parser for large files\n**Consequence:** Out-of-memory crash on multi-GB message log files
<!-- SECTION:DESCRIPTION:END -->
