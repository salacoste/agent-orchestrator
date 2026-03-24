---
id: task-17.5
title: 'Fix: brace expansion {a,b} not supported in glob patterns'
status: Done
assignee: []
created_date: '2026-03-24 11:38'
updated_date: '2026-03-24 12:01'
labels:
  - edge-case
  - sandbox
dependencies: []
parent_task_id: task-17
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `agent-sandbox.ts:27`\n**Trigger:** Glob pattern uses {src,lib}/**/*.ts brace expansion\n**Fix:** Document limitation or implement brace expansion\n**Consequence:** Braces escaped as literals, pattern won't match as expected
<!-- SECTION:DESCRIPTION:END -->
