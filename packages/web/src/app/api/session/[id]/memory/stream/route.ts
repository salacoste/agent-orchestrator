/**
 * GET /api/session/[id]/memory/stream — SSE stream for project memory changes.
 *
 * Sends an initial memory snapshot, then polls every 5 seconds for changes
 * (compares JSON.stringify). Sends heartbeat every 15 seconds.
 * Sends events as `event: memory-update` with JSON data payload.
 * Cleans up intervals on cancel.
 *
 * Story 60-9, AC #6.
 */

import { type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { readProjectMemory, emptyProjectMemory } from "@composio/ao-core/project-memory";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let lastSnapshot = "";

      // Send initial memory snapshot, THEN start polling
      void (async () => {
        try {
          const { sessionManager } = await getServices();
          const session = await sessionManager.get(id);

          if (!session || !session.workspacePath) {
            const payload = {
              sessionId: id,
              memory: emptyProjectMemory(),
              exists: false,
            };
            controller.enqueue(
              encoder.encode(`event: memory-update\ndata: ${JSON.stringify(payload)}\n\n`),
            );
            lastSnapshot = JSON.stringify(payload);
            return;
          }

          let memory = emptyProjectMemory();
          try {
            memory = await readProjectMemory(session.workspacePath);
          } catch {
            // Memory read failure — send empty
          }

          const payload = { sessionId: id, memory, exists: true };
          controller.enqueue(
            encoder.encode(`event: memory-update\ndata: ${JSON.stringify(payload)}\n\n`),
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

              let memory = emptyProjectMemory();
              try {
                memory = await readProjectMemory(session.workspacePath);
              } catch {
                return;
              }

              const payload = { sessionId: id, memory, exists: true };
              const currentSnapshot = JSON.stringify(payload);
              if (currentSnapshot !== lastSnapshot) {
                lastSnapshot = currentSnapshot;
                controller.enqueue(
                  encoder.encode(`event: memory-update\ndata: ${JSON.stringify(payload)}\n\n`),
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
