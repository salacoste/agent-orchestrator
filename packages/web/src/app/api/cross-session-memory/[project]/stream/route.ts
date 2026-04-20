/**
 * GET /api/cross-session-memory/[project]/stream — SSE stream for cross-session memory changes.
 *
 * Sends an initial snapshot, then polls every 5 seconds for changes
 * (compares JSON.stringify). Sends heartbeat every 15 seconds.
 * Sends events as `event: memory-update` with JSON data payload.
 * Config-gated: returns empty snapshot when feature disabled.
 *
 * Story 61-2, AC #7.
 */

import { type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { loadAccumulatedMemory } from "@composio/ao-core/memory-bridge";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ project: string }> },
) {
  const { project } = await params;
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let lastSnapshot = "";

      void (async () => {
        try {
          const { config } = await getServices();
          const projectConfig = config.projects[project];

          // Send error event for unknown project and close
          if (!projectConfig) {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ error: "Project not found" })}\n\n`,
              ),
            );
            controller.close();
            return;
          }

          const enabled = projectConfig.learning?.crossSessionMemory === true;

          const payload = enabled
            ? { entries: await loadAccumulatedMemory(projectConfig.path), project, enabled: true }
            : { entries: [], project, enabled: false };

          controller.enqueue(
            encoder.encode(`event: memory-update\ndata: ${JSON.stringify(payload)}\n\n`),
          );
          lastSnapshot = JSON.stringify(payload);

          // Only poll when enabled
          if (!enabled) return;

          poll = setInterval(() => {
            void (async () => {
              try {
                const entries = await loadAccumulatedMemory(projectConfig.path);
                const current = { entries, project, enabled: true };
                const snapshot = JSON.stringify(current);
                if (snapshot !== lastSnapshot) {
                  lastSnapshot = snapshot;
                  controller.enqueue(
                    encoder.encode(`event: memory-update\ndata: ${JSON.stringify(current)}\n\n`),
                  );
                }
              } catch {
                // Transient error — skip this poll
              }
            })();
          }, 5000);
        } catch {
          // Service init failure — skip initial snapshot
        }
      })();

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          if (poll) clearInterval(poll);
        }
      }, 15000);
    },
    cancel() {
      clearInterval(heartbeat);
      clearInterval(poll);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
