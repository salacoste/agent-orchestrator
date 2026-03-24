---
id: task-17.2
title: 'Fix: path traversal (../) bypasses glob sandbox patterns'
status: To Do
assignee: []
created_date: '2026-03-24 11:38'
labels:
  - edge-case
  - sandbox
  - security
dependencies: []
parent_task_id: task-17
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `agent-sandbox.ts:46`\n**Trigger:** filePath contains path traversal like ../../../etc/passwd\n**Fix:** Normalize path with path.resolve() before checking against patterns\n**Consequence:** Glob patterns may not match traversal paths that escape sandbox directory
<!-- SECTION:DESCRIPTION:END -->
