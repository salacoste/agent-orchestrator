---
id: task-19.1
title: 'Fix: CRLF vs LF line endings cause false conflict detection'
status: Done
assignee: []
created_date: '2026-03-24 11:39'
updated_date: '2026-03-24 12:02'
labels:
  - edge-case
  - conflict-wizard
dependencies: []
parent_task_id: task-19
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `conflict-wizard.ts:47`\n**Trigger:** Files with different line endings (\\r\\n vs \\n)\n**Fix:** `const normalize = (s: string) => s.replace(/\\r\\n/g, '\\n');` before split\n**Consequence:** CRLF vs LF difference marks every line as changed, false conflict detected
<!-- SECTION:DESCRIPTION:END -->
