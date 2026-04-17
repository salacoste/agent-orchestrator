import { getServices } from "@/lib/services";
import { sessionToDashboard } from "@/lib/serialize";
import { getAttentionLevel } from "@/lib/types";
import { subscribeWorkflowChanges } from "@/lib/workflow-watcher";
import { subscribeCollaborationChanges } from "@/lib/workflow/collaboration";
import { getSharedCascadeDetector } from "@/lib/workflow/cascade-detector-shared";
import { buildPhasePresence, scanAllArtifacts } from "@/lib/workflow/scan-artifacts";
import { computePhaseStates } from "@/lib/workflow/compute-state";
import type { PhaseEntry } from "@/lib/workflow/types";
import { subscribeCrossProjectDepChanges } from "@/lib/cross-project-dep-events";
import { detectAndBroadcast } from "@/lib/conflict-broadcaster";
import { CONFLICT_SSE_EVENT_TYPE } from "@/lib/conflict-sse-constants";
import {
  readSprintStatus,
  readForecastLog,
  markForecastActual,
} from "@composio/ao-plugin-tracker-bmad";
import { subscribeForecastChanges } from "@/lib/forecast-change-broadcaster";
import { subscribeRiskAlerts, evaluateCachedAndBroadcast } from "@/lib/risk-alert-broadcaster";
import { RISK_ALERT_SSE_EVENT_TYPE } from "@/lib/risk-alert-sse-constants";
import { getAlertConfig } from "@/lib/risk-alert-config";
import { computeAgentUtilization, getCapacityStatus } from "@composio/ao-core";
import { collectSnapshot, type SnapshotInput } from "@/lib/utilization-snapshot";
import { recordSnapshots } from "@/lib/utilization-history";

export const dynamic = "force-dynamic";

/** Track last-known done-story counts per project (Story 55.4 forecast-stale detection) */
const prevDoneCounts = new Map<string, number>();

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
  let unsubCrossProjectDeps: (() => void) | undefined;
  let unsubForecastChanges: (() => void) | undefined;
  let unsubRiskAlerts: (() => void) | undefined;

  // Track previous phase states for transition detection (Story 16.5)
  let prevPhases: PhaseEntry[] | null = null;

  // Shared cascade detector — accessible by both SSE route and resume endpoint (Story 40.1)
  const cascadeDetector = getSharedCascadeDetector();

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

      // Subscribe to forecast change events (Story 55.4)
      unsubForecastChanges = subscribeForecastChanges((pId, diff, newP50) => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "forecast-changed", project: pId, diff, newP50, timestamp: new Date().toISOString() })}\n\n`,
            ),
          );
        } catch {
          // Stream closed — will be cleaned up by cancel()
        }
      });

      // Subscribe to cross-project dependency changes (Story 51.5)
      unsubCrossProjectDeps = subscribeCrossProjectDepChanges((event) => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "cross-project-dep-changed", action: event.action, depId: event.depId, timestamp: event.timestamp })}\n\n`,
            ),
          );
        } catch {
          // Stream closed — will be cleaned up by cancel()
        }
      });

      // Subscribe to risk alert broadcasts (Story 56.5)
      unsubRiskAlerts = subscribeRiskAlerts((alerts) => {
        try {
          for (const alert of alerts) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: RISK_ALERT_SSE_EVENT_TYPE, alert, timestamp: new Date().toISOString() })}\n\n`,
              ),
            );
          }
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

          // Resource conflict detection (Story 52.2)
          try {
            const services = await getServices();
            const newConflicts = detectAndBroadcast(services.config);
            if (newConflicts.length > 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: CONFLICT_SSE_EVENT_TYPE, conflicts: newConflicts, timestamp: new Date().toISOString() })}\n\n`,
                ),
              );
            }
          } catch {
            // Conflict detection error is non-fatal — session polling continues
          }

          // Forecast-stale detection (Story 55.4)
          // Track done-story counts per project — emit forecast-stale when count changes.
          try {
            const services = await getServices();
            for (const project of Object.values(services.config.projects)) {
              try {
                const sprint = readSprintStatus(project);
                let doneCount = 0;
                for (const entry of Object.values(sprint.development_status)) {
                  if (
                    entry &&
                    typeof entry === "object" &&
                    (entry as { status?: string }).status === "done"
                  ) {
                    doneCount++;
                  }
                }
                const prevCount = prevDoneCounts.get(project.name);
                if (prevCount !== undefined && prevCount !== doneCount) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "forecast-stale", project: project.name, timestamp: new Date().toISOString() })}\n\n`,
                    ),
                  );
                }
                prevDoneCounts.set(project.name, doneCount);

                // Forecast calibration (Story 55.3 Task 4.3)
                // When all stories are done, mark the latest open forecast with actual date.
                const totalCount = Object.keys(sprint.development_status).length;
                if (totalCount > 0 && doneCount === totalCount) {
                  const log = readForecastLog(project);
                  const openForecast = [...log].reverse().find((e) => !e.actualCompletionDate);
                  if (openForecast) {
                    markForecastActual(
                      project,
                      openForecast.timestamp,
                      new Date().toISOString().slice(0, 10),
                    );
                  }
                }
              } catch {
                // Individual project read failure is non-fatal
              }
            }
          } catch {
            // Forecast-stale detection error is non-fatal — session polling continues
          }

          // Risk alert evaluation (Story 56.5)
          // Uses cached score data updated by the risk score route.
          try {
            evaluateCachedAndBroadcast(getAlertConfig());
          } catch {
            // Risk alert evaluation error is non-fatal — session polling continues
          }

          // Utilization snapshot collection (Story 56.6)
          // Record point-in-time snapshots every poll cycle for rolling averages.
          try {
            const services = await getServices();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const registry = services.registry as any;
            const utilSessions = await services.sessionManager.list();
            const allSessions = utilSessions as Parameters<typeof computeAgentUtilization>[0];
            const agentUtils = computeAgentUtilization(allSessions, registry, services.config);
            const projectIds = Object.keys(services.config.projects ?? {});
            const allSnaps: ReturnType<typeof collectSnapshot> = [];
            for (const pid of projectIds) {
              const projectSessions = allSessions.filter((s) => s.projectId === pid);
              const workloadMap = new Map<string, number>();
              const agentProjectMap = new Map<string, string>();
              for (const session of projectSessions) {
                const current = workloadMap.get(session.id) ?? 0;
                workloadMap.set(session.id, current + 1);
                agentProjectMap.set(session.id, pid);
              }
              const capacityStatus = getCapacityStatus(
                workloadMap,
                services.config,
                agentProjectMap,
              );
              const capacityArr = [...capacityStatus.values()].map((c) => ({
                agentId: c.agentId,
                utilizationPercent: c.utilizationPercent,
                isAtCapacity: c.isAtCapacity,
                isNearCapacity: c.isNearCapacity,
              }));
              const input: SnapshotInput = {
                agentUtilizations: agentUtils
                  .filter((u) => u.projectId === pid)
                  .map((u) => ({
                    agentId: u.agentId,
                    utilizationPercent: u.utilizationPercent,
                    isActive: u.isActive,
                    storiesWorked: u.storiesWorked,
                    isPoolAgent: u.isPoolAgent,
                    projectId: u.projectId,
                  })),
                capacityResults: capacityArr,
                projectId: pid,
              };
              const freshSnapshots = collectSnapshot(input);
              allSnaps.push(...freshSnapshots);
            }
            if (allSnaps.length > 0) {
              recordSnapshots(allSnaps);
              // Broadcast utilization snapshot event (C3 — Story 56.6)
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "utilization.snapshot", agentCount: allSnaps.length, timestamp: new Date().toISOString() })}\n\n`,
                ),
              );
            }
          } catch {
            // Utilization snapshot error is non-fatal — session polling continues
          }
        })();
      }, 5000);
    },
    cancel() {
      clearInterval(heartbeat);
      clearInterval(updates);
      unsubWorkflow?.();
      unsubCollab?.();
      unsubCrossProjectDeps?.();
      unsubForecastChanges?.();
      unsubRiskAlerts?.();
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
