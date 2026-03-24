---
id: task-18.2
title: 'Fix: extremely long input causes regex catastrophic backtracking (DoS)'
status: Done
assignee: []
created_date: '2026-03-24 11:39'
updated_date: '2026-03-24 12:01'
labels:
  - edge-case
  - nlu-parser
  - security
dependencies: []
parent_task_id: task-18
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `nlu-parser.ts:96`\n**Trigger:** Extremely long input string with patterns that cause .*? backtracking\n**Fix:** `if (trimmed.length > 500) return [fallbackIntent];` — cap input length\n**Consequence:** Patterns with .*? and .+ could cause exponential backtracking on crafted input
<!-- SECTION:DESCRIPTION:END -->
