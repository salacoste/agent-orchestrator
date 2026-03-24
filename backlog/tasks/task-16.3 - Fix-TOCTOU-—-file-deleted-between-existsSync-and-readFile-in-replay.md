---
id: task-16.3
title: 'Fix: TOCTOU — file deleted between existsSync and readFile in replay'
status: Done
assignee: []
created_date: '2026-03-24 11:37'
updated_date: '2026-03-24 12:01'
labels:
  - edge-case
  - message-bus
  - crash
dependencies: []
parent_task_id: task-16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `message-bus.ts:104`\n**Trigger:** JSONL file deleted between existsSync and readFile\n**Fix:** Wrap readFile in try/catch, return 0 on ENOENT\n**Consequence:** ENOENT exception propagates unhandled to caller
<!-- SECTION:DESCRIPTION:END -->
