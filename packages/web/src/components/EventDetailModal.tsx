"use client";

interface Event {
  id: string;
  type: string;
  timestamp: string;
  data: {
    storyId?: string;
    agentId?: string;
    reason?: string;
    status?: string;
    [key: string]: unknown;
  };
  hash: string;
}

interface EventDetailModalProps {
  event: Event;
  events: Event[];
  isOpen: boolean;
  onClose: () => void;
}

export default function EventDetailModal({
  event,
  events,
  isOpen,
  onClose,
}: EventDetailModalProps) {
  if (!isOpen) return null;

  // Filter to only related events (by storyId or agentId)
  const relatedEvents = event.data.storyId
    ? events.filter((e) => e.data.storyId === event.data.storyId)
    : event.data.agentId
      ? events.filter((e) => e.data.agentId === event.data.agentId)
      : [event];

  const relatedIndex = relatedEvents.findIndex((e) => e.id === event.id);
  const currentEvent = relatedEvents[relatedIndex] || event;
  const hasPrevious = relatedIndex > 0;
  const hasNext = relatedIndex < relatedEvents.length - 1;

  const handlePrevious = () => {
    if (hasPrevious && onClose) {
      // Navigate to previous related event
      onClose(); // Close current modal
      // In a real implementation, we'd pass the previous event to open
      // For now, we just close - the parent would need to track navigation state
    }
  };

  const handleNext = () => {
    if (hasNext && onClose) {
      // Navigate to next related event
      onClose(); // Close current modal
      // In a real implementation, we'd pass the next event to open
      // For now, we just close - the parent would need to track navigation state
    }
  };

  const copyJSON = () => {
    const json = JSON.stringify(currentEvent, null, 2);
    navigator.clipboard.writeText(json);
  };

  const formatDate = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-[var(--color-bg-surface)] rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-default)]">
          <h2 id="modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
            Event Details
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Event ID and Type */}
          <div>
            <span className="text-sm text-[var(--color-text-muted)]">Event ID:</span>
            <span className="ml-2 font-mono text-sm">{currentEvent.id}</span>
          </div>

          <div>
            <span className="text-sm text-[var(--color-text-muted)]">Type:</span>
            <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
              {currentEvent.type.replace(/\./g, " ")}
            </span>
          </div>

          <div>
            <span className="text-sm text-[var(--color-text-muted)]">Timestamp:</span>
            <span className="ml-2 text-sm">{formatDate(currentEvent.timestamp)}</span>
          </div>

          {/* Event Data */}
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Event Data
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {currentEvent.data.storyId && (
                <div>
                  <span className="text-[var(--color-text-muted)]">Story ID:</span>
                  <span className="ml-2">{currentEvent.data.storyId}</span>
                </div>
              )}
              {currentEvent.data.agentId && (
                <div>
                  <span className="text-[var(--color-text-muted)]">Agent ID:</span>
                  <span className="ml-2">{currentEvent.data.agentId}</span>
                </div>
              )}
              {currentEvent.data.reason && (
                <div>
                  <span className="text-[var(--color-text-muted)]">Reason:</span>
                  <span className="ml-2">{currentEvent.data.reason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Event Hash for Integrity */}
          <div>
            <span className="text-sm text-[var(--color-text-muted)]">Hash (SHA-256):</span>
            <span className="ml-2 font-mono text-xs">{currentEvent.hash}</span>
          </div>

          {/* JSON Viewer */}
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Event Payload
            </h3>
            <button
              onClick={copyJSON}
              className="px-3 py-1 text-xs bg-[var(--color-accent)] text-[var(--color-accent-foreground)] rounded hover:opacity-90 mb-2"
            >
              Copy JSON
            </button>
            <pre className="bg-[var(--color-bg-hover)] rounded p-3 overflow-x-auto text-xs">
              <code>{JSON.stringify(currentEvent, null, 2)}</code>
            </pre>
          </div>

          {/* Related Events Links */}
          {relatedEvents.length > 1 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Related Events
              </h3>
              <div className="space-y-1 text-xs">
                {relatedEvents.map((e, idx) => (
                  <div
                    key={e.id}
                    className={`flex items-center gap-2 ${idx === relatedIndex ? "font-semibold" : ""}`}
                  >
                    <span className="font-mono">{e.id}</span>
                    <span>→</span>
                    <span>{e.type.replace(/\./g, " ")}</span>
                    <span className="text-[var(--color-text-muted)]">
                      {formatDate(e.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--color-border-default)]">
          <button
            onClick={handlePrevious}
            disabled={!hasPrevious}
            className="px-4 py-2 text-sm border border-[var(--color-border-default)] rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-[var(--color-text-muted)]">
            {relatedIndex + 1} of {relatedEvents.length}
          </span>
          <button
            onClick={handleNext}
            disabled={!hasNext}
            className="px-4 py-2 text-sm border border-[var(--color-border-default)] rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
