---
id: task-12
title: WIP status dashboard widget
status: Done
assignee: []
created_date: '2026-03-05 00:37'
updated_date: '2026-03-05 01:01'
labels:
  - bmad
  - phase-5
  - visualization
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
New WipStatusWidget.tsx component showing per-column WIP current/limit as visual bars. Uses existing getWipStatus() from sprint-health.ts which returns Record&lt;string, { current, limit }&gt;. Color-coded: green (under limit), yellow (at limit), red (over limit). Place on the board tab above the kanban columns. API data already available via /api/sprint/[project]/config (wipLimits) + column counts from the main sprint route.
<!-- SECTION:DESCRIPTION:END -->
