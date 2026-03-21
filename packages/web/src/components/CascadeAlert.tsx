import type { CascadeStatus } from "@/lib/workflow/cascade-detector";

interface CascadeAlertProps {
  status: CascadeStatus | null;
  onResume?: () => void;
}

/**
 * Cascade failure alert banner (Story 25b.1).
 *
 * Displays when 3+ agent failures detected in 5 minutes.
 * Shows "Resume All" button to clear cascade pause.
 */
export function CascadeAlert({ status, onResume }: CascadeAlertProps) {
  if (!status || !status.paused) return null;

  return (
    <div
      className="rounded-[6px] border-2 border-red-500 bg-red-500/10 px-5 py-4"
      data-testid="cascade-alert"
      role="alert"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-red-400">🚨 Cascade Failure Detected</p>
          <p className="text-[12px] text-[var(--color-text-secondary)] mt-1">
            {status.failureCount} agent failures in the last 5 minutes. All agents paused to prevent
            token waste. Check for systemic issues (API outage, config error) before resuming.
          </p>
        </div>
        {onResume && (
          <button
            type="button"
            className="ml-4 px-4 py-2 text-[12px] font-semibold rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors whitespace-nowrap"
            data-testid="cascade-resume-button"
            onClick={onResume}
          >
            Resume All
          </button>
        )}
      </div>
    </div>
  );
}
