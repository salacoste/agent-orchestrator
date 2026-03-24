---
id: task-18.1
title: 'Fix: "spawn for " with trailing space produces empty storyId param'
status: Done
assignee: []
created_date: '2026-03-24 11:38'
updated_date: '2026-03-24 12:01'
labels:
  - edge-case
  - nlu-parser
dependencies: []
parent_task_id: task-18
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `nlu-parser.ts:33`\n**Trigger:** Input 'spawn for ' with trailing space, m[1].trim() returns ''\n**Fix:** `const storyId = m[1].trim(); if (!storyId) return {};` — skip empty params\n**Consequence:** Returns { storyId: '' } — downstream may try to spawn for empty story ID
<!-- SECTION:DESCRIPTION:END -->
