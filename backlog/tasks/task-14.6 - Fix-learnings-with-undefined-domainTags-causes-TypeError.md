---
id: task-14.6
title: 'Fix: learnings with undefined domainTags causes TypeError'
status: Done
assignee: []
created_date: '2026-03-24 11:36'
updated_date: '2026-03-24 11:49'
labels:
  - edge-case
  - sprint-simulator
  - crash
dependencies: []
parent_task_id: task-14
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `sprint-simulator.ts:96`\n**Trigger:** learnings array contains entries with missing or undefined domainTags\n**Fix:** `filter(l => l.outcome === 'completed' && Array.isArray(l.domainTags))`\n**Consequence:** l.domainTags.some() throws TypeError if domainTags is undefined
<!-- SECTION:DESCRIPTION:END -->
