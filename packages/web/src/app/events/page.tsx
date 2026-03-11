"use client";

import { useState, useEffect } from "react";
import { useSSEConnection } from "@/hooks/useSSEConnection";
import { useFlashAnimation } from "@/hooks/useFlashAnimation";
import EventDetailModal from "@/components/EventDetailModal";

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

interface EventsResponse {
  events: Event[];
  total: number;
}

interface FilterState {
  type: string;
  storyId: string;
  agentId: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [newEventsCount, setNewEventsCount] = useState(0);
  const [showLoadNew, setShowLoadNew] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [filter, setFilter] = useState<FilterState>({
    type: "",
    storyId: "",
    agentId: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  });

  // Modal state for event details
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const flash = useFlashAnimation([events]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "100",
        ...(filter.type && { type: filter.type }),
        ...(filter.storyId && { storyId: filter.storyId }),
        ...(filter.agentId && { agentId: filter.agentId }),
        ...(filter.search && { search: filter.search }),
        ...(filter.dateFrom && { since: filter.dateFrom }),
      });

      const response = await fetch(`/api/audit/events?${params}`);
      const data: EventsResponse = await response.json();

      if (!response.ok && response.status !== 404) {
        throw new Error("Failed to fetch events");
      }
      setEvents(data.events);
      setTotal(data.total);
      setNewEventsCount(0);
      setShowLoadNew(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, filter]);

  // SSE integration for real-time updates
  useSSEConnection({
    onStoryStarted: () => {
      setNewEventsCount((c) => c + 1);
      setShowLoadNew(true);
      // Auto-refresh if enabled
      if (autoRefresh) {
        fetchEvents();
      }
    },
    onStoryCompleted: () => {
      setNewEventsCount((c) => c + 1);
      setShowLoadNew(true);
      if (autoRefresh) {
        fetchEvents();
      }
    },
    onStoryBlocked: () => {
      setNewEventsCount((c) => c + 1);
      setShowLoadNew(true);
      if (autoRefresh) {
        fetchEvents();
      }
    },
    onAgentStatusChanged: () => {
      setNewEventsCount((c) => c + 1);
      setShowLoadNew(true);
      if (autoRefresh) {
        fetchEvents();
      }
    },
  });

  const formatEventType = (type: string): string => {
    return type.replace(/\./g, " ");
  };

  const getEventSummary = (event: Event): string => {
    if (event.type === "story.completed") {
      return `Story ${event.data.storyId} completed by agent ${event.data.agentId}`;
    }
    if (event.type === "story.blocked") {
      return `Story ${event.data.storyId} blocked: ${event.data.reason}`;
    }
    if (event.type === "agent.status_changed") {
      return `Agent ${event.data.agentId} status changed`;
    }
    return `${event.type}`;
  };

  const getEventBadgeColor = (type: string): string => {
    if (type === "story.completed") return "bg-green-100 text-green-800";
    if (type === "story.blocked") return "bg-red-100 text-red-800";
    if (type === "story.started") return "bg-blue-100 text-blue-800";
    if (type === "agent.status_changed") return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  const handleSearchChange = (value: string) => {
    setFilter((prev) => ({ ...prev, search: value }));
    setPage(1);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        ...(filter.type && { type: filter.type }),
        ...(filter.storyId && { storyId: filter.storyId }),
        ...(filter.agentId && { agentId: filter.agentId }),
        ...(filter.search && { search: filter.search }),
        ...(filter.dateFrom && { since: filter.dateFrom }),
        limit: "10000",
      });

      const response = await fetch(`/api/audit/events/export?${params}`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `events-${filter.dateFrom || "all"}-to-${filter.dateTo || "now"}.jsonl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export events");
    } finally {
      setIsExporting(false);
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Event Audit Trail</h1>
        <p>Loading events...</p>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Event Audit Trail</h1>
        <p className="text-red-600">Failed to load events: {error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Event Audit Trail</h1>
        <div className="flex gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">auto-refresh</span>
          </label>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isExporting ? "Exporting..." : "Export Events"}
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="mb-4 p-4 bg-[var(--color-bg-hover)] rounded-lg">
        <h2 className="text-sm font-semibold mb-3 text-[var(--color-text-primary)]">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input
            type="text"
            placeholder="Search events..."
            value={filter.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="px-3 py-2 border rounded"
            aria-label="Search events by keyword"
          />
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            className="px-3 py-2 border rounded"
            aria-label="Filter by event type"
          >
            <option value="">All Event Types</option>
            <option value="story.started">Story Started</option>
            <option value="story.completed">Story Completed</option>
            <option value="story.blocked">Story Blocked</option>
            <option value="agent.status_changed">Agent Status Changed</option>
          </select>
          <input
            type="text"
            placeholder="Story ID"
            value={filter.storyId}
            onChange={(e) => setFilter({ ...filter, storyId: e.target.value })}
            className="px-3 py-2 border rounded"
            aria-label="Filter by story ID"
          />
          <input
            type="text"
            placeholder="Agent ID"
            value={filter.agentId}
            onChange={(e) => setFilter({ ...filter, agentId: e.target.value })}
            className="px-3 py-2 border rounded"
            aria-label="Filter by agent ID"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dateFrom" className="text-xs text-[var(--color-text-muted)]">
              From Date:
            </label>
            <input
              id="dateFrom"
              type="date"
              value={filter.dateFrom}
              onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
              className="px-3 py-2 border rounded w-full"
              aria-label="Filter events from this date"
            />
          </div>
          <div>
            <label htmlFor="dateTo" className="text-xs text-[var(--color-text-muted)]">
              To Date:
            </label>
            <input
              id="dateTo"
              type="date"
              value={filter.dateTo}
              onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
              className="px-3 py-2 border rounded w-full"
              aria-label="Filter events until this date"
            />
          </div>
        </div>
      </div>

      {/* Event Count with New Events Indicator */}
      <div className="mb-4 flex items-center justify-between">
        <p>
          Showing {events.length} of {total} events
          {newEventsCount > 0 && <span className="ml-2 text-blue-600">({newEventsCount} new)</span>}
        </p>
        {showLoadNew && (
          <button
            onClick={fetchEvents}
            className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${flash ? "animate-pulse" : ""}`}
          >
            Load new events
          </button>
        )}
      </div>

      {/* Events Table */}
      {events.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[var(--color-text-muted)]">No events found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Event ID</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Timestamp</th>
                <th className="text-left p-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b hover:bg-[var(--color-bg-hover)]">
                  <td className="p-2 font-mono text-sm">
                    <button
                      onClick={() => handleEventClick(event)}
                      className="text-blue-600 hover:underline cursor-pointer text-left"
                      aria-label={`View details for event ${event.id}`}
                    >
                      {event.id}
                    </button>
                  </td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getEventBadgeColor(event.type)}`}
                    >
                      {formatEventType(event.type)}
                    </span>
                  </td>
                  <td className="p-2 text-sm">{new Date(event.timestamp).toLocaleString()}</td>
                  <td className="p-2 text-sm">{getEventSummary(event)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 100 && (
        <div className="mt-4 flex items-center justify-between">
          <p>
            Page {page} of {Math.ceil(total / 100)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 100 >= total}
              className="px-4 py-2 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          events={events}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
