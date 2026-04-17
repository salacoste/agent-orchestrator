import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { readForecastLog, computeCalibration } from "@composio/ao-plugin-tracker-bmad";

export async function GET(_request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({
        calibration: {
          totalForecasts: 0,
          withinP50: 0,
          withinP80: 0,
          withinP95: 0,
          p50Accuracy: 0,
          p80Accuracy: 0,
          p95Accuracy: 0,
          bias: 0,
          insufficientData: true,
        },
        forecastComparisons: [],
        accuracyTrend: "stable",
      });
    }

    const calibration = computeCalibration(project);

    // Build per-forecast comparison data
    const allEntries = readForecastLog(project);
    const completed = allEntries.filter(
      (e) => e.actualCompletionDate && e.actualCompletionDate !== "",
    );

    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    const forecastComparisons = completed.map((e) => {
      const actual = e.actualCompletionDate as string;
      return {
        timestamp: e.timestamp,
        predictedP50: e.percentiles.p50,
        predictedP80: e.percentiles.p80,
        predictedP95: e.percentiles.p95,
        actualDate: actual,
        biasDays: Math.round(
          (new Date(actual).getTime() - new Date(e.percentiles.p50).getTime()) / MS_PER_DAY,
        ),
      };
    });

    // Compute accuracy trend: compare last 3 vs previous 3
    let accuracyTrend: "improving" | "stable" | "degrading" = "stable";
    if (completed.length >= 6) {
      const recent = completed.slice(-3);
      const previous = completed.slice(-6, -3);

      const recentHitRate =
        recent.filter(
          (e) =>
            (new Date(e.actualCompletionDate as string).getTime() -
              new Date(e.percentiles.p50).getTime()) /
              MS_PER_DAY <=
            0,
        ).length / recent.length;

      const previousHitRate =
        previous.filter(
          (e) =>
            (new Date(e.actualCompletionDate as string).getTime() -
              new Date(e.percentiles.p50).getTime()) /
              MS_PER_DAY <=
            0,
        ).length / previous.length;

      const diff = (recentHitRate - previousHitRate) * 100;
      if (diff > 10) accuracyTrend = "improving";
      else if (diff < -10) accuracyTrend = "degrading";
    }

    return NextResponse.json({
      calibration,
      forecastComparisons,
      accuracyTrend,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
