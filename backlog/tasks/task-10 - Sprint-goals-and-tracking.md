---
id: task-10
title: Sprint goals and tracking
status: Done
assignee: []
created_date: '2026-03-05 00:37'
updated_date: '2026-03-05 01:13'
labels:
  - bmad
  - phase-5
  - planning
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
New module sprint-goals.ts that reads sprint goal config from project.tracker.sprintGoals (targetStories, targetPoints, targetDate). Computes progress (current vs target), pace (ahead/on-track/behind/at-risk), and confidence (% chance of hitting goal via Monte Carlo). Reuses computeForecast(), computeMonteCarloForecast(), readSprintStatus(). Includes: sprint-goals.test.ts (~8 tests), CLI command `ao goals [project]` with --json, API route GET /api/sprint/[project]/goals, SprintGoalsCard.tsx component with progress bars, pace badge, and confidence percentage.
<!-- SECTION:DESCRIPTION:END -->
