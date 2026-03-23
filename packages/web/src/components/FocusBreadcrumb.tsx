/**
 * Breadcrumb for focus mode navigation (Story 44.6).
 */

interface FocusBreadcrumbProps {
  /** Display name of the focused agent. */
  agentName: string;
  /** Called when "Dashboard" link is clicked to exit focus mode. */
  onBack: () => void;
}

export function FocusBreadcrumb({ agentName, onBack }: FocusBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" data-testid="focus-breadcrumb">
      <ol className="flex items-center gap-1 text-[11px]">
        <li>
          <button
            type="button"
            onClick={onBack}
            className="text-[var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm"
            data-testid="breadcrumb-back"
          >
            Dashboard
          </button>
        </li>
        <li aria-hidden="true" className="text-[var(--color-text-muted)]">
          &gt;
        </li>
        <li>
          <span className="text-[var(--color-text-primary)] font-medium" aria-current="page">
            {agentName}
          </span>
        </li>
      </ol>
    </nav>
  );
}
