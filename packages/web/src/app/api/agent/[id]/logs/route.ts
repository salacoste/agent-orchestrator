import { NextResponse, type NextRequest } from "next/server";

import { getServices } from "@/lib/services";
import { readLastLogLines, getLogFilePath, hasLogFile, getSessionsDir } from "@composio/ao-core";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/[id]/logs — Get agent session logs (Story 38.3)
 *
 * Reads the last N log lines from the agent's log file via
 * the core log-capture module. Falls back to metadata previousLogsPath.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: agentId } = await params;
    const { sessionManager, config } = await getServices();

    // Verify agent exists and get session data
    const session = await sessionManager.get(agentId);
    if (!session) {
      return NextResponse.json({ error: `Agent ${agentId} not found` }, { status: 404 });
    }

    // Parse line count from query params (default 100, clamped 1-1000)
    const url = new URL(request.url);
    const parsed = parseInt(url.searchParams.get("lines") ?? "100", 10);
    const lines = Math.max(1, Math.min(Number.isNaN(parsed) ? 100 : parsed, 1000));

    // Find sessions dir for this project
    const project = config.projects[session.projectId];
    if (!project) {
      return NextResponse.json({
        logs: [],
        source: "none",
        message: "Project not found in config",
      });
    }

    const sessionsDir = getSessionsDir(config.configPath, project.path);

    // Try primary log file first.
    // Note: readLastLogLines uses synchronous readFileSync (core API design).
    // Acceptable for dashboard polling; async variant needed for high-traffic.
    if (hasLogFile(sessionsDir, agentId)) {
      const logPath = getLogFilePath(sessionsDir, agentId);
      const logLines = readLastLogLines(logPath, lines);
      return NextResponse.json({
        logs: logLines,
        source: "primary",
      });
    }

    // Fall back to previousLogsPath from metadata.
    // Validate path is under sessions dir to prevent reading arbitrary files.
    const previousLogsPath = session.metadata["previousLogsPath"];
    if (previousLogsPath && previousLogsPath.startsWith(sessionsDir)) {
      const logLines = readLastLogLines(previousLogsPath, lines);
      if (logLines.length > 0) {
        return NextResponse.json({
          logs: logLines,
          source: "previous",
        });
      }
    }

    // No logs available
    return NextResponse.json({
      logs: [],
      source: "none",
      message: `No log file found for agent ${agentId}`,
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
