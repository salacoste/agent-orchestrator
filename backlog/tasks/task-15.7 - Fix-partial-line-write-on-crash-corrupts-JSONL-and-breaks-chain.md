---
id: task-15.7
title: 'Fix: partial line write on crash corrupts JSONL and breaks chain'
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
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `immutable-audit-log.ts:167`\n**Trigger:** doAppend throws after partial line written\n**Fix:** Consider write-to-temp-then-rename pattern for atomic writes\n**Consequence:** Partial JSON line in file makes subsequent reads skip it, chain integrity broken
<!-- SECTION:DESCRIPTION:END -->
