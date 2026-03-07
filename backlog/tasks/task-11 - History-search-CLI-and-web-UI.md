---
id: task-11
title: History search CLI and web UI
status: Done
assignee: []
created_date: '2026-03-05 00:37'
updated_date: '2026-03-05 01:01'
labels:
  - bmad
  - phase-5
  - cli
  - web
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose existing history-query.ts (queryHistory function with HistoryFilter) via CLI and web. CLI: `ao history search [project]` with options --story, --status, --from-date, --to-date, --json. API: GET /api/sprint/[project]/history/search with query params. Web: Add search/filter controls to the history view — story ID filter, status filter, date range picker. history-query.ts already supports all filtering, just needs surface.
<!-- SECTION:DESCRIPTION:END -->
