/**
 * GET /api/session/[id]/notepad/stream — SSE stream for notepad change notifications.
 *
 * Sends an initial notepad snapshot, then polls every 5 seconds for changes
 * (compares content hash). Sends heartbeat every 15 seconds. Cleans up on cancel.
 *
 * Epic 60, Story 60-1 (FR-D1-3).
 */

import { type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { readNotepad } from "@composio/ao-core";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const EMPTY_NOTEPAD: { priority: string; working: string; manual: string } = Object.freeze({
  priority: "",
  working: "",
  manual: "",
});

function hashNotepad(notepad: { priority: string; working: string; manual: string }): string {
  return createHash("md5").update(JSON.stringify(notepad)).digest("hex");
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let lastHash = "";

      // Send initial notepad snapshot, THEN start polling (avoids race condition)
      void (async () => {
        try {
          const { sessionManager } = await getServices();
          const session = await sessionManager.get(id);

          if (!session || !session.workspacePath) {
            const payload = {
              type: "notepad-update",
              sessionId: id,
              notepad: EMPTY_NOTEPAD,
              exists: false,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            lastHash = hashNotepad(EMPTY_NOTEPAD);
            return;
          }

          let notepad = EMPTY_NOTEPAD;
          try {
            notepad = await readNotepad(session.workspacePath);
          } catch {
            // Notepad read failure — send empty
          }

          const exists =
            notepad.priority.trim() !== "" ||
            notepad.working.trim() !== "" ||
            notepad.manual.trim() !== "";
          const payload = { type: "notepad-update", sessionId: id, notepad, exists };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          lastHash = hashNotepad(notepad);
        } catch {
          // Service init failure — skip initial snapshot, still start poll as recovery
        }

        // Start poll AFTER initial snapshot completes (fixes race condition)
        poll = setInterval(() => {
          void (async () => {
            try {
              const { sessionManager } = await getServices();
              const session = await sessionManager.get(id);

              if (!session || !session.workspacePath) return;

              let notepad = EMPTY_NOTEPAD;
              try {
                notepad = await readNotepad(session.workspacePath);
              } catch {
                return;
              }

              const currentHash = hashNotepad(notepad);
              if (currentHash !== lastHash) {
                lastHash = currentHash;
                const exists =
                  notepad.priority.trim() !== "" ||
                  notepad.working.trim() !== "" ||
                  notepad.manual.trim() !== "";
                const payload = { type: "notepad-update", sessionId: id, notepad, exists };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
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
