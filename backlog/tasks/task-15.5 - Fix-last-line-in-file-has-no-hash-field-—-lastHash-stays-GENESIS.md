---
id: task-15.5
title: 'Fix: last line in file has no hash field — lastHash stays GENESIS'
status: Done
assignee: []
created_date: '2026-03-24 11:37'
updated_date: '2026-03-24 11:50'
labels:
  - edge-case
  - audit-log
  - data-corruption
dependencies: []
parent_task_id: task-15
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `immutable-audit-log.ts:122`\n**Trigger:** Last line is valid JSON but missing hash field\n**Fix:** `if (parsed.hash && typeof parsed.hash === 'string') { lastHash = parsed.hash; }`\n**Consequence:** lastHash stays GENESIS, new entries fork from genesis breaking chain
<!-- SECTION:DESCRIPTION:END -->
