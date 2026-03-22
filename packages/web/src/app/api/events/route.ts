import { getServices } from "@/lib/services";
import { sessionToDashboard } from "@/lib/serialize";
import { getAttentionLevel } from "@/lib/types";
import { subscribeWorkflowChanges } from "@/lib/workflow-watcher";
import { subscribeCollaborationChanges } from "@/lib/workflow/collaboration";
import { createWiredCascadeDetector } from "@/lib/workflow/cascade-detector-wired";
import { buildPhasePresence, scanAllArtifacts } from "@/lib/workflow/scan-artifacts";
import { computePhaseStates } from "@/lib/workflow/compute-state";
import type { PhaseEntry } from "@/lib/workflow/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/events — SSE stream for real-time lifecycle events
 *
 * Sends session state updates to connected clients.
 * Polls SessionManager.list() on an interval (no SSE push from core yet).
 * Also emits typed workflow events (Story 16.5).
 */
export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let updates: ReturnType<typeof setInterval> | undefined;

  let unsubWorkflow: (() => void) | undefined;
  let unsubCollab: (() => void) | undefined;

  // Track previous phase states for transition detection (Story 16.5)
  let prevPhases: PhaseEntry[] | null = null;

  // Cascade failure detector — auto-records from session snapshots (Story 39.3)
  const cascadeDetector = createWiredCascadeDetector();

  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to collaboration changes (Story 39.1).
      // Broadcasts full event data — collaboration types contain only display-safe fields
      // (userId, displayName, page, itemId, decision text). No secrets or internal paths.
      unsubCollab = subscribeCollaborationChanges((event) => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: `collaboration.${event.type}`, action: event.action, data: event.data, timestamp: event.timestamp })}\n\n`,
            ),
          );
        } catch {
          // Stream closed — will be cleaned up by cancel()
        }
      });

      // Subscribe to workflow file-change notifications (WD-5 + Story 16.5)
      unsubWorkflow = subscribeWorkflowChanges(() => {
        try {
          // 1. Backward-compatible generic signal
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "workflow-change" })}\n\n`),
          );

          // 2. Typed workflow events (Story 16.5) — detect phase transitions
          void emitWorkflowEvents(controller, encoder);
        } catch {
          // Stream closed — will be cleaned up by cancel()
        }
      });

      /**
       * Emit typed workflow events by comparing current phase states
       * with previous states. Runs asynchronously after the generic signal.
       */
      async function emitWorkflowEvents(
        ctrl: ReadableStreamDefaultController,
        enc: TextEncoder,
      ): Promise<void> {
        try {
          const projectRoot = process.cwd();
          const artifacts = await scanAllArtifacts(projectRoot);
          const presence = buildPhasePresence(artifacts);
          const phases = computePhaseStates(presence);
          const now = new Date().toISOString();

          // Detect phase transitions
          if (prevPhases) {
            for (let i = 0; i < phases.length; i++) {
              const prev = prevPhases[i];
              const curr = phases[i];
              if (prev && curr && prev.state !== curr.state) {
                ctrl.enqueue(
                  enc.encode(
                    `data: ${JSON.stringify({
                      type: "workflow.phase",
                      phase: curr.id,
                      previousState: prev.state,
                      newState: curr.state,
                      timestamp: now,
                    })}\n\n`,
                  ),
                );
              }
            }
          }

          prevPhases = phases;
        } catch {
          // Scan failed — skip typed events, generic signal was already sent
        }
      }

      // Send initial snapshot
      void (async () => {
        try {
          const { sessionManager } = await getServices();
          const sessions = await sessionManager.list();
          const dashboardSessions = sessions.map(sessionToDashboard);

          const initialEvent = {
            type: "snapshot",
            sessions: dashboardSessions.map((s) => ({
              id: s.id,
              status: s.status,
              activity: s.activity,
              attentionLevel: getAttentionLevel(s),
              lastActivityAt: s.lastActivityAt,
            })),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`));
        } catch {
          // If services aren't available, send empty snapshot
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "snapshot", sessions: [] })}\n\n`),
          );
        }
      })();

      // Send periodic heartbeat
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
          clearInterval(updates);
        }
      }, 15000);

      // Poll for session state changes every 5 seconds
      updates = setInterval(() => {
        void (async () => {
          let dashboardSessions;
          try {
            const { sessionManager } = await getServices();
            const sessions = await sessionManager.list();
            dashboardSessions = sessions.map(sessionToDashboard);
          } catch {
            // Transient service error — skip this poll, retry on next interval
            return;
          }

          try {
            const event = {
              type: "snapshot",
              sessions: dashboardSessions.map((s) => ({
                id: s.id,
                status: s.status,
                activity: s.activity,
                attentionLevel: getAttentionLevel(s),
                lastActivityAt: s.lastActivityAt,
              })),
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // enqueue failure means the stream is closed — clean up both intervals
            clearInterval(updates);
            clearInterval(heartbeat);
          }

          // Feed session snapshot to cascade detector (Story 39.3).
          // Separate try/catch — cascade errors must not kill the SSE stream.
          try {
            const cascadeTriggered = cascadeDetector.processSnapshot(
              dashboardSessions.map((s) => ({ id: s.id, status: s.status })),
            );
            if (cascadeTriggered) {
              const cascadeStatus = cascadeDetector.getStatus();
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "cascade.triggered", failureCount: cascadeStatus.failureCount, timestamp: new Date().toISOString() })}\n\n`,
                ),
              );
            }
          } catch {
            // Cascade detection error is non-fatal — session polling continues
          }
        })();
      }, 5000);
    },
    cancel() {
      clearInterval(heartbeat);
      clearInterval(updates);
      unsubWorkflow?.();
      unsubCollab?.();
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
