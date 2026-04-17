import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  computeMonteCarloForecast,
  appendForecastLog,
  computeCalibration,
  computeForecastDiff,
} from "@composio/ao-plugin-tracker-bmad";
import { broadcastForecastChange } from "@/lib/forecast-change-broadcaster";

/** Cache last forecast percentiles per project for diff detection (Story 55.4) — LRU eviction at 200 entries */
const MAX_CACHED_FORECASTS = 200;
const lastForecast = new Map<string, { p50: string; p80: string; p95: string; _ts: number }>();

function setLastForecast(key: string, value: { p50: string; p80: string; p95: string }) {
  if (lastForecast.size >= MAX_CACHED_FORECASTS) {
    // Evict oldest entry (Map iteration order = insertion order)
    const iter = lastForecast.keys().next();
    if (iter.done === false) {
      lastForecast.delete(iter.value);
    }
  }
  lastForecast.set(key, { ...value, _ts: Date.now() });
}

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const url = new URL(request.url);
    const epicFilter = url.searchParams.get("epic") || undefined;
    const simulationsParam = url.searchParams.get("simulations");
    const simulations = simulationsParam ? parseInt(simulationsParam, 10) : undefined;
    const windowParam = url.searchParams.get("throughputWindowDays");
    const throughputWindowDays = windowParam ? parseInt(windowParam, 10) : undefined;
    const excludeWeekends = url.searchParams.get("excludeWeekends") !== "false";
    const confidenceLevelsParam = url.searchParams.get("confidenceLevels");
    const confidenceLevels = confidenceLevelsParam
      ? confidenceLevelsParam.split(",").map((l) => l.trim().toLowerCase())
      : undefined;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({
        percentiles: { p50: "", p80: "", p95: "" },
        histogram: [],
        remainingStories: 0,
        simulationCount: 0,
        sampleSize: 0,
        averageDailyRate: 0,
        linearCompletionDate: null,
        linearConfidence: 0,
        insufficientData: true,
      });
    }

    const simCount =
      simulations && !isNaN(simulations)
        ? Math.max(1000, Math.min(100000, simulations))
        : undefined;
    const windowDays =
      throughputWindowDays && !isNaN(throughputWindowDays)
        ? Math.max(0, Math.min(365, throughputWindowDays))
        : undefined;

    const result = computeMonteCarloForecast(project, epicFilter, {
      simulations: simCount,
      throughputWindowDays: windowDays && windowDays > 0 ? windowDays : undefined,
      excludeWeekends,
    });

    // Filter displayed percentiles by confidenceLevels param
    const effectiveConfidenceLevels = confidenceLevels || ["p50", "p80", "p95"];
    const filteredPercentiles: Record<string, string> = {};
    for (const level of effectiveConfidenceLevels) {
      if (level === "p50" && result.percentiles.p50)
        filteredPercentiles.p50 = result.percentiles.p50;
      if (level === "p80" && result.percentiles.p80)
        filteredPercentiles.p80 = result.percentiles.p80;
      if (level === "p95" && result.percentiles.p95)
        filteredPercentiles.p95 = result.percentiles.p95;
    }

    const effectiveConfig = {
      simulations: result.simulationCount,
      throughputWindowDays: windowDays ?? 0,
      excludeWeekends,
      dataPointsUsed: result.sampleSize,
    };

    // Append forecast snapshot to JSONL log (non-fatal best-effort)
    if (!result.insufficientData && result.percentiles.p50) {
      appendForecastLog(project, {
        timestamp: new Date().toISOString(),
        projectId,
        epicFilter,
        percentiles: result.percentiles,
        remainingStories: result.remainingStories,
        simulationCount: result.simulationCount,
      });

      // Detect significant forecast change and broadcast (Story 55.4)
      const prev = lastForecast.get(projectId);
      if (prev) {
        const diff = computeForecastDiff(prev, result.percentiles);
        if (diff.significantChange) {
          broadcastForecastChange(projectId, diff, result.percentiles.p50);
        }
      }
      setLastForecast(projectId, result.percentiles);
    }

    // Compute calibration score from historical forecast log
    const calibration = computeCalibration(project, epicFilter);

    return NextResponse.json({
      ...result,
      percentiles: filteredPercentiles,
      calibration,
      effectiveConfig,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
