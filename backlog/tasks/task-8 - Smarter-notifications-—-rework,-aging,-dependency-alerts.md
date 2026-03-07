---
id: task-8
title: 'Smarter notifications — rework, aging, dependency alerts'
status: Done
assignee: []
created_date: '2026-03-05 00:37'
updated_date: '2026-03-05 01:13'
labels:
  - bmad
  - phase-5
  - notifications
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enrich getNotifications() in sprint-notifications.ts to alert on: (1) rework rate spikes — when backward transitions exceed a threshold, (2) individual story aging — when a story exceeds P90 age for its column, (3) dependency cycle detection — when circular dependencies are found, (4) velocity trending down — when weekly velocity drops consistently. Leverage existing computeRework(), computeStoryAging(), computeDependencyGraph(), and computeVelocityComparison() modules. Add configurable thresholds to tracker config.
<!-- SECTION:DESCRIPTION:END -->
