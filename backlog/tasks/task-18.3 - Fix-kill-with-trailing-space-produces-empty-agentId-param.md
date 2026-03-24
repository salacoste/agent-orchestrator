---
id: task-18.3
title: 'Fix: "kill " with trailing space produces empty agentId param'
status: Done
assignee: []
created_date: '2026-03-24 11:39'
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
**File:** `nlu-parser.ts:45`\n**Trigger:** Input 'kill ' with trailing space, m[1] captures empty/whitespace\n**Fix:** `const agentId = m[1].trim(); if (!agentId) return {};`\n**Consequence:** Returns { agentId: '' } — downstream may attempt to kill non-existent agent
<!-- SECTION:DESCRIPTION:END -->
