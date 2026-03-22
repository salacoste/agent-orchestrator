interface OwnerBadgeProps {
  owner: string | null;
}

/**
 * Owner badge for agent cards (Story 42.2).
 *
 * Displays the assigned owner name, or "Unassigned" when no owner.
 */
export function OwnerBadge({ owner }: OwnerBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
        owner
          ? "bg-blue-500/10 text-blue-400"
          : "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
      }`}
      data-testid="owner-badge"
    >
      {owner ?? "Unassigned"}
    </span>
  );
}
