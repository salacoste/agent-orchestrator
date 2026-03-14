export function EmptyWorkflowState() {
  return (
    <section
      aria-label="BMAD workflow not configured"
      className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-8 text-center"
    >
      <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-3">
        BMAD Workflow Dashboard
      </h2>
      <p className="text-[13px] text-[var(--color-text-secondary)] mb-4 max-w-md mx-auto">
        This project doesn&apos;t have a BMAD configuration yet. The Workflow tab shows your
        project&apos;s progress through the BMAD methodology phases: Analysis, Planning,
        Solutioning, and Implementation.
      </p>
      <p className="text-[12px] text-[var(--color-text-muted)] max-w-md mx-auto">
        To get started, initialize BMAD in your project by creating a{" "}
        <code className="text-[11px] font-mono text-[var(--color-text-secondary)]">_bmad/</code>{" "}
        directory with a product brief. The dashboard will automatically detect your artifacts and
        track phase progression.
      </p>
    </section>
  );
}
