---
id: task-13
title: Dependency cycle visualization in graph view
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
DependencyGraphView.tsx currently shows dependency edges but doesn't highlight circular dependencies. dependencies.ts already detects cycles via DFS and returns circularWarnings in DependencyGraph. Update DependencyGraphView to: (1) highlight nodes involved in cycles with red borders/background, (2) draw cycle edges in red with a distinctive style, (3) show a warning banner listing detected cycles. The data (circularWarnings: string[][]) is already returned by the dependencies API.
<!-- SECTION:DESCRIPTION:END -->
