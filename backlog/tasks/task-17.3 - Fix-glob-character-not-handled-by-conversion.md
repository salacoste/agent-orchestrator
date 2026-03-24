---
id: task-17.3
title: 'Fix: glob ? character not handled by conversion'
status: To Do
assignee: []
created_date: '2026-03-24 11:38'
labels:
  - edge-case
  - sandbox
dependencies: []
parent_task_id: task-17
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `agent-sandbox.ts:27`\n**Trigger:** Glob pattern contains ? (single-char wildcard)\n**Fix:** Add `escaped.replace(/\\?/g, '[^/]')` to globToRegex\n**Consequence:** ? treated as literal question mark, not single-char wildcard as users expect
<!-- SECTION:DESCRIPTION:END -->
