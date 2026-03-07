---
id: task-9
title: Forecast overlay on burndown chart
status: Done
assignee: []
created_date: '2026-03-05 00:37'
updated_date: '2026-03-05 01:13'
labels:
  - bmad
  - phase-5
  - analytics
  - visualization
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Overlay forecast lines on BurndownChart: (1) linear regression projected line from computeForecast(), (2) Monte Carlo P50/P85/P95 as shaded confidence bands from computeMonteCarloForecast(), (3) sprint goal target line if goals are configured. Update the metrics/burndown API to include forecast data. Add SVG overlay elements to BurndownChart.tsx with distinct colors: linear=dashed blue, P50=solid orange, P85/P95=shaded orange bands, goal=dashed red target line.
<!-- SECTION:DESCRIPTION:END -->
