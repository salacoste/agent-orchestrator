---
id: task-17.1
title: 'Fix: malformed glob produces invalid regex — new RegExp throws'
status: To Do
assignee: []
created_date: '2026-03-24 11:38'
labels:
  - edge-case
  - sandbox
  - crash
dependencies: []
parent_task_id: task-17
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `agent-sandbox.ts:32`\n**Trigger:** Malformed glob pattern produces invalid regex (e.g., unbalanced brackets)\n**Fix:** `try { return new RegExp(...); } catch { return /(?!)/; }` — catch and return never-matching regex\n**Consequence:** new RegExp throws on invalid pattern, crashes checkAccess caller
<!-- SECTION:DESCRIPTION:END -->
