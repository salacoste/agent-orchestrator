---
id: task-19.2
title: 'Fix: trailing newline creates extra empty element after split'
status: Done
assignee: []
created_date: '2026-03-24 11:39'
updated_date: '2026-03-24 12:02'
labels:
  - edge-case
  - conflict-wizard
dependencies: []
parent_task_id: task-19
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `conflict-wizard.ts:47`\n**Trigger:** One version has trailing newline and another doesn't\n**Fix:** Trim trailing newline before split, or ignore trailing empty element\n**Consequence:** Last line appears changed due to '' vs actual content, false overlap detected
<!-- SECTION:DESCRIPTION:END -->
