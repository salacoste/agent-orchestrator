---
id: task-14.4
title: 'Fix: seed=0 degenerates LCG random number generator'
status: Done
assignee: []
created_date: '2026-03-24 11:36'
updated_date: '2026-03-24 11:48'
labels:
  - edge-case
  - sprint-simulator
dependencies: []
parent_task_id: task-14
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `sprint-simulator.ts:60`\n**Trigger:** Seed of 0 makes LCG start from constant\n**Fix:** `let state = seed === 0 ? 1 : seed;`\n**Consequence:** Seed 0 degenerates LCG — first value always same constant
<!-- SECTION:DESCRIPTION:END -->
