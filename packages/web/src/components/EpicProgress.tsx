"use client";

interface EpicSummary {
  epicId: string;
  title: string;
  total: number;
  done: number;
  inProgress: number;
  open: number;
  percent: number;
}

interface EpicProgressProps {
  epics: EpicSummary[];
  onFilterEpic?: (epicId: string | null) => void;
  activeEpic?: string | null;
}

export type { EpicSummary };

export function EpicProgress({ epics, onFilterEpic, activeEpic }: EpicProgressProps) {
  if (epics.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.10em] text-[var(--color-text-tertiary)]">
          Epics
        </h3>
        {activeEpic && onFilterEpic && (
          <button
            onClick={() => onFilterEpic(null)}
            className="rounded px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors"
          >
            Show All
          </button>
        )}
      </div>
      <div className="space-y-2">
        {epics.map((epic) => {
          const isActive = activeEpic === epic.epicId;
          const isFiltered = activeEpic !== null && activeEpic !== undefined && !isActive;

          return (
            <button
              key={epic.epicId}
              onClick={() => onFilterEpic?.(isActive ? null : epic.epicId)}
              aria-label={`Filter by epic ${epic.title !== epic.epicId ? epic.title : epic.epicId}`}
              aria-pressed={isActive}
              className={`w-full rounded-[6px] border px-3 py-2 text-left transition-all ${
                isActive
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)]"
                  : isFiltered
                    ? "border-[var(--color-border-subtle)] bg-transparent opacity-50 hover:opacity-80"
                    : "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-default)]"
              }`}
            >
              {/* Label row */}
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--color-text-primary)]">
                  <span className="font-mono text-[var(--color-text-secondary)]">
                    {epic.epicId}
                  </span>
                  {epic.title !== epic.epicId && (
                    <span className="ml-1.5 text-[var(--color-text-secondary)]">{epic.title}</span>
                  )}
                </span>
                <span className="text-[10px] tabular-nums text-[var(--color-text-secondary)]">
                  {epic.done}/{epic.total} stories ({epic.percent}%)
                </span>
              </div>

              {/* Progress bar */}
              <div
                className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-subtle)]"
                role="progressbar"
                aria-label={`${epic.done} of ${epic.total} stories done`}
                aria-valuenow={epic.done}
                aria-valuemin={0}
                aria-valuemax={epic.total}
              >
                {epic.done > 0 && epic.total > 0 && (
                  <div
                    className="h-full bg-[var(--color-accent-green)] transition-all duration-300"
                    style={{ width: `${(epic.done / epic.total) * 100}%` }}
                  />
                )}
                {epic.inProgress > 0 && epic.total > 0 && (
                  <div
                    className="h-full bg-[var(--color-accent-blue)] transition-all duration-300"
                    style={{ width: `${(epic.inProgress / epic.total) * 100}%` }}
                  />
                )}
                {epic.open > 0 && epic.total > 0 && (
                  <div
                    className="h-full bg-[var(--color-text-tertiary)] transition-all duration-300"
                    style={{ width: `${(epic.open / epic.total) * 100}%` }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[var(--color-accent-green)]" />
          <span className="text-[10px] text-[var(--color-text-secondary)]">Done</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[var(--color-accent-blue)]" />
          <span className="text-[10px] text-[var(--color-text-secondary)]">In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[var(--color-text-tertiary)]" />
          <span className="text-[10px] text-[var(--color-text-secondary)]">Open</span>
        </div>
      </div>
    </div>
  );
}
