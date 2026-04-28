/**
 * GET /api/session/[id]/timeline/stream — SSE stream for timeline change notifications.
 *
 * Sends an initial timeline snapshot, then polls every 10 seconds for changes
 * (compares entry count). Sends heartbeat every 15 seconds. Cleans up on cancel.
 *
 * Epic 60, Story 60-3 (FR-D2-3).
 */

import { type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { readTimeline, type TimelineEntry } from "@composio/ao-core";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let lastCount = 0;

      // Send initial timeline snapshot, THEN start polling (avoids race condition)
      void (async () => {
        let snapshotSent = false;
        try {
          const { sessionManager } = await getServices();
          const session = await sessionManager.get(id);

          if (!session || !session.workspacePath) {
            const payload = {
              type: "timeline-update",
              sessionId: id,
              timeline: [],
              totalEntries: 0,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            lastCount = 0;
            snapshotSent = true;
            return;
          }

          let entries: TimelineEntry[];
          try {
            entries = await readTimeline(session.workspacePath, id);
          } catch {
            entries = [];
          }

          const payload = {
            type: "timeline-update",
            sessionId: id,
            timeline: entries,
            totalEntries: entries.length,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          lastCount = entries.length;
          snapshotSent = true;
        } catch {
          // Service init failure — skip initial snapshot
        }

        // Only start polling if we successfully sent an initial snapshot
        if (!snapshotSent) return;

        poll = setInterval(() => {
          void (async () => {
            try {
              const { sessionManager } = await getServices();
              const session = await sessionManager.get(id);

              if (!session || !session.workspacePath) return;

              const entries = await readTimeline(session.workspacePath, id);

              if (entries.length !== lastCount) {
                lastCount = entries.length;
                const payload = {
                  type: "timeline-update",
                  sessionId: id,
                  timeline: entries,
                  totalEntries: entries.length,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
              }
            } catch {
              // Transient service error — skip this poll
            }
          })();
        }, 10000);
      })();

      // Heartbeat every 15 seconds
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          clearInterval(poll);
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
