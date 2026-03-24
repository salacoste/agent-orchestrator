---
id: task-19.3
title: 'Fix: whitespace-only API key passes truthy check, returns stub'
status: To Do
assignee: []
created_date: '2026-03-24 11:39'
labels:
  - edge-case
  - conflict-wizard
dependencies: []
parent_task_id: task-19
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `conflict-wizard.ts:87`\n**Trigger:** apiKey is whitespace-only string like '   ' (truthy)\n**Fix:** `if (!apiKey || apiKey.trim() === '') return null;`\n**Consequence:** Whitespace API key bypasses null check, returns useless stub suggestion
<!-- SECTION:DESCRIPTION:END -->
