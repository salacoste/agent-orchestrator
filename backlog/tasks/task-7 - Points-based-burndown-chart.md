---
id: task-7
title: Points-based burndown chart
status: Done
assignee: []
created_date: '2026-03-05 00:37'
updated_date: '2026-03-05 01:13'
labels:
  - bmad
  - phase-5
  - analytics
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BurndownChart currently only tracks story count. Points data already exists in sprint-status.yaml (hasPointsData/getPoints). Modify BurndownChart.tsx to support both count-based and points-based burndown views. Update the metrics API endpoint to return points burndown data alongside count data. Add a toggle in the UI to switch between count and points views.
<!-- SECTION:DESCRIPTION:END -->
