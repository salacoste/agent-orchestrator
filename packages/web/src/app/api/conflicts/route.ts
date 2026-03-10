import { NextResponse } from "next/server";

/**
 * GET /api/conflicts
 * List all agent assignment conflicts
 */
export async function GET() {
  try {
    // For now, return mock data since we don't have a real conflict detection service wired up
    // In a real implementation, this would query the ConflictDetectionService
    const conflicts = [
      {
        conflictId: "conflict-1",
        storyId: "STORY-123",
        existingAgent: "agent-alpha",
        conflictingAgent: "agent-beta",
        type: "duplicate_assignment",
        detectedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        severity: "high",
        priorityScores: { "agent-alpha": 0.7, "agent-beta": 0.3 },
        recommendations: [
          "Agent alpha has higher priority due to more progress",
          "Consider terminating agent-beta to allow agent-alpha to continue",
        ],
        resolution: undefined,
      },
      {
        conflictId: "conflict-2",
        storyId: "STORY-456",
        existingAgent: "agent-gamma",
        conflictingAgent: "agent-delta",
        type: "concurrent_spawn",
        detectedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        severity: "medium",
        priorityScores: { "agent-gamma": 1.5, "agent-delta": 0.4 },
        recommendations: [
          "Priority scores are close - manual review recommended",
          "Check story progress before deciding",
        ],
        resolution: undefined,
      },
      {
        conflictId: "conflict-3",
        storyId: "STORY-789",
        existingAgent: "agent-epsilon",
        conflictingAgent: "agent-zeta",
        type: "duplicate_assignment",
        detectedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        severity: "low",
        priorityScores: { "agent-epsilon": 1.2, "agent-zeta": 0.8 },
        recommendations: ["Similar priority - consider project requirements"],
        resolution: {
          resolution: "keep-existing",
          resolvedAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
          resolvedBy: "system",
        },
      },
    ];

    return NextResponse.json({ conflicts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list conflicts" },
      { status: 500 },
    );
  }
}
