/**
 * GET /api/session/[id]/state/stream — SSE stream for session state changes.
 *
 * Sends an initial state snapshot, then polls every 5 seconds for changes
 * (compares JSON.stringify). Sends heartbeat every 15 seconds.
 * Sends events as `event: state-update` with JSON data payload.
 * Cleans up intervals on cancel.
 *
 * Epic 60, Story 60-7 (FR-D4-1, FR-D4-2).
 */

import { type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { readSessionState, emptySessionState } from "@composio/ao-core/session-state";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let lastSnapshot = "";

      // Send initial state snapshot, THEN start polling
      void (async () => {
        try {
          const { sessionManager } = await getServices();
          const session = await sessionManager.get(id);

          if (!session || !session.workspacePath) {
            const payload = {
              sessionId: id,
              state: emptySessionState(),
              exists: false,
            };
            controller.enqueue(
              encoder.encode(`event: state-update\ndata: ${JSON.stringify(payload)}\n\n`),
            );
            lastSnapshot = JSON.stringify(payload);
            return;
          }

          let state = emptySessionState();
          try {
            state = await readSessionState(session.workspacePath, session.metadata);
          } catch {
            // State read failure — send empty
          }

          const payload = { sessionId: id, state, exists: true };
          controller.enqueue(
            encoder.encode(`event: state-update\ndata: ${JSON.stringify(payload)}\n\n`),
          );
          lastSnapshot = JSON.stringify(payload);
        } catch {
          // Service init failure — skip initial snapshot, still start poll as recovery
        }

        // Start poll AFTER initial snapshot completes
        poll = setInterval(() => {
          void (async () => {
            try {
              const { sessionManager } = await getServices();
              const session = await sessionManager.get(id);

              if (!session || !session.workspacePath) return;

              let state = emptySessionState();
              try {
                state = await readSessionState(session.workspacePath, session.metadata);
              } catch {
                return;
              }

              const payload = { sessionId: id, state, exists: true };
              const currentSnapshot = JSON.stringify(payload);
              if (currentSnapshot !== lastSnapshot) {
                lastSnapshot = currentSnapshot;
                controller.enqueue(
                  encoder.encode(`event: state-update\ndata: ${JSON.stringify(payload)}\n\n`),
                );
              }
            } catch {
              // Transient service error — skip this poll
            }
          })();
        }, 5000);
      })();

      // Heartbeat every 15 seconds
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
