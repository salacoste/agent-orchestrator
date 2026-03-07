"use client";

interface ConnectionStatusProps {
  connected: boolean;
  reconnecting: boolean;
}

export function ConnectionStatus({ connected, reconnecting }: ConnectionStatusProps) {
  return (
    <div
      data-testid="connection-status"
      className="always-visible flex items-center gap-2 text-[11px]"
    >
      <span aria-label="connection status">{connected ? "🟢" : "🔴"}</span>
      <span className="text-[var(--color-text-muted)]">
        {connected ? "connected" : "disconnected"}
      </span>
      {reconnecting && !connected && (
        <span className="ml-2 text-[var(--color-status-attention)]">
          Reconnecting to event stream...
        </span>
      )}
    </div>
  );
}
