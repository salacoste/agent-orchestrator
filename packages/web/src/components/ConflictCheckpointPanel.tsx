import type { FileConflict } from "@/lib/workflow/conflict-detector";
import type { CheckpointTimeline } from "@/lib/workflow/checkpoint-tracker";

interface ConflictCheckpointPanelProps {
  conflicts: FileConflict[];
  timeline: CheckpointTimeline | null;
  onRollback?: (sha: string) => void;
}

/**
 * Conflict detection + checkpoint timeline panel (Story 25b.3).
 *
 * Shows file conflicts between agents and checkpoint rollback timeline.
 */
export function ConflictCheckpointPanel({
  conflicts,
  timeline,
  onRollback,
}: ConflictCheckpointPanelProps) {
  const hasContent = conflicts.length > 0 || (timeline && timeline.checkpoints.length > 0);

  return (
    <section
      aria-label="Conflicts and checkpoints"
      className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4"
    >
      <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
        Conflicts & Checkpoints
      </h2>

      {conflicts.length > 0 && (
        <div className="mb-3" data-testid="conflict-list">
          <p className="text-[12px] font-semibold text-[var(--color-status-attention)] mb-2">
            ⚠️ {conflicts.length} file conflict{conflicts.length !== 1 ? "s" : ""} detected
          </p>
          <ul className="space-y-1">
            {conflicts.map((c, i) => (
              <li
                key={`${c.filePath}-${i}`}
                className="text-[11px] text-[var(--color-text-secondary)]"
              >
                <span className="font-mono">{c.filePath}</span>
                <span className="text-[var(--color-text-muted)]">
                  {" "}
                  — {c.agentA} vs {c.agentB}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {timeline && timeline.checkpoints.length > 0 && (
        <div data-testid="checkpoint-timeline">
          <p className="text-[12px] text-[var(--color-text-muted)] mb-2">
            {timeline.checkpoints.length} checkpoint{timeline.checkpoints.length !== 1 ? "s" : ""}{" "}
            for {timeline.agentId}
          </p>
          <div className="space-y-1">
            {timeline.checkpoints.map((cp) => (
              <div key={cp.sha} className="flex items-center justify-between text-[11px]">
                <div>
                  <span className="font-mono text-[var(--color-text-primary)]">
                    {cp.sha.slice(0, 7)}
                  </span>
                  <span className="text-[var(--color-text-muted)] ml-2">
                    {cp.filesChanged} file{cp.filesChanged !== 1 ? "s" : ""}
                  </span>
                </div>
                {onRollback && (
                  <button
                    type="button"
                    className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-status-attention)] transition-colors"
                    onClick={() => onRollback(cp.sha)}
                    data-testid={`rollback-${cp.sha.slice(0, 7)}`}
                  >
                    Rollback
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasContent && (
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          No conflicts or checkpoints to display.
        </p>
      )}
    </section>
  );
}
