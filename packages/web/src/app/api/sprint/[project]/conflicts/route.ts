import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  createConflictDetectionService,
  getAgentRegistry,
  getSessionsDir,
} from "@composio/ao-core";

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get agent registry
    const sessionsDir = getSessionsDir(config.configPath, projectId);
    const registry = getAgentRegistry(sessionsDir, config);

    // Create conflict detection service
    const conflictService = createConflictDetectionService(registry, {
      enabled: true,
    });

    // Get all conflicts
    const conflicts = conflictService.getConflicts();

    // Format conflicts for API response
    const formattedConflicts = conflicts.map((conflict) => ({
      conflictId: conflict.conflictId,
      storyId: conflict.storyId,
      existingAgent: conflict.existingAgent,
      conflictingAgent: conflict.conflictingAgent,
      type: conflict.type,
      severity: conflict.severity,
      detectedAt: conflict.detectedAt.toISOString(),
      priorityScores: conflict.priorityScores,
      recommendations: conflict.recommendations,
      resolution: conflict.resolution
        ? {
            resolution: conflict.resolution.resolution,
            resolvedAt: conflict.resolution.resolvedAt?.toISOString(),
          }
        : null,
    }));

    // Get query parameters for sorting/export
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get("sort") || "recency"; // recency, frequency
    const exportFormat = searchParams.get("export"); // csv, json

    // Sort conflicts
    const sortedConflicts = [...formattedConflicts];
    if (sortBy === "recency") {
      sortedConflicts.sort(
        (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
      );
    } else if (sortBy === "frequency") {
      // Group by story and count conflicts
      const storyFrequency = new Map<string, number>();
      for (const conflict of sortedConflicts) {
        storyFrequency.set(conflict.storyId, (storyFrequency.get(conflict.storyId) || 0) + 1);
      }
      sortedConflicts.sort(
        (a, b) => (storyFrequency.get(b.storyId) || 0) - (storyFrequency.get(a.storyId) || 0),
      );
    }

    // Handle export formats
    if (exportFormat === "csv") {
      // Generate CSV
      const headers = [
        "Conflict ID",
        "Story ID",
        "Existing Agent",
        "Conflicting Agent",
        "Type",
        "Severity",
        "Detected At",
        "Resolution",
        "Resolved At",
      ];
      const rows = sortedConflicts.map((c) => [
        c.conflictId,
        c.storyId,
        c.existingAgent,
        c.conflictingAgent,
        c.type,
        c.severity,
        c.detectedAt,
        c.resolution?.resolution || "",
        c.resolution?.resolvedAt || "",
      ]);
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="conflicts-${projectId}.csv"`,
        },
      });
    }

    if (exportFormat === "json") {
      return new NextResponse(JSON.stringify(sortedConflicts, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="conflicts-${projectId}.json"`,
        },
      });
    }

    // Return JSON response
    return NextResponse.json({
      conflicts: sortedConflicts,
      summary: {
        total: sortedConflicts.length,
        bySeverity: {
          critical: sortedConflicts.filter((c) => c.severity === "critical").length,
          high: sortedConflicts.filter((c) => c.severity === "high").length,
          medium: sortedConflicts.filter((c) => c.severity === "medium").length,
          low: sortedConflicts.filter((c) => c.severity === "low").length,
        },
        byType: {
          "duplicate-assignment": sortedConflicts.filter((c) => c.type === "duplicate-assignment")
            .length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching conflicts:", error);
    return NextResponse.json({ error: "Failed to fetch conflicts" }, { status: 500 });
  }
}
