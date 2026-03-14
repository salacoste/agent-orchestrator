import { PHASE_LABELS, type ClassifiedArtifact, type Phase } from "@/lib/workflow/types.js";

interface WorkflowArtifactInventoryProps {
  artifacts: ClassifiedArtifact[];
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  if (date.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${date.getFullYear()}`;
}

function phaseLabel(phase: Phase | null): string {
  if (phase === null) return "—";
  return PHASE_LABELS[phase];
}

export function WorkflowArtifactInventory({ artifacts }: WorkflowArtifactInventoryProps) {
  return (
    <section
      aria-label="Artifact inventory"
      className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4 h-full"
    >
      <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
        Artifacts
      </h2>
      {artifacts.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr>
              <th
                scope="col"
                className="text-left text-[11px] text-[var(--color-text-muted)] font-medium uppercase pb-2"
              >
                Name
              </th>
              <th
                scope="col"
                className="text-left text-[11px] text-[var(--color-text-muted)] font-medium uppercase pb-2"
              >
                Type
              </th>
              <th
                scope="col"
                className="text-left text-[11px] text-[var(--color-text-muted)] font-medium uppercase pb-2"
              >
                Phase
              </th>
              <th
                scope="col"
                className="text-left text-[11px] text-[var(--color-text-muted)] font-medium uppercase pb-2"
              >
                Path
              </th>
              <th
                scope="col"
                className="text-right text-[11px] text-[var(--color-text-muted)] font-medium uppercase pb-2"
              >
                Modified
              </th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((artifact) => (
              <tr key={artifact.path} className={artifact.phase === null ? "opacity-60" : ""}>
                <td className="py-1 pr-3">
                  <span className="sr-only">
                    {artifact.filename}, {artifact.type} artifact
                    {artifact.phase !== null
                      ? ` in ${phaseLabel(artifact.phase)} phase`
                      : ", uncategorized"}
                    , modified {formatDate(artifact.modifiedAt)}
                  </span>
                  <span
                    className="text-[13px] text-[var(--color-text-primary)] leading-tight"
                    aria-hidden="true"
                  >
                    {artifact.filename}
                  </span>
                </td>
                <td className="py-1 pr-3" aria-hidden="true">
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    {artifact.type}
                  </span>
                </td>
                <td className="py-1 pr-3" aria-hidden="true">
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    {phaseLabel(artifact.phase)}
                  </span>
                </td>
                <td className="py-1 pr-3 max-w-[200px]" aria-hidden="true">
                  <span className="text-[11px] text-[var(--color-text-muted)] block truncate">
                    {artifact.path}
                  </span>
                </td>
                <td className="py-1 text-right" aria-hidden="true">
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {formatDate(artifact.modifiedAt)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          No artifacts generated yet.
        </p>
      )}
    </section>
  );
}
