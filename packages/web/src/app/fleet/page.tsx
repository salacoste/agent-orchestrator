"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSSEConnection } from "@/hooks/useSSEConnection";
import { useFlashAnimation } from "@/hooks/useFlashAnimation";
import { FleetMatrix } from "@/components/FleetMatrix";
import type { DashboardSession } from "@/lib/types";

interface FleetStats {
  total: number;
  active: number;
  idle: number;
  blocked: number;
}

export default function FleetPage() {
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  const fetchData = () => {
    setLoading(true);
    setError(null);

    fetch("/api/sessions?active=true")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load fleet status");
        return res.json();
      })
      .then((data) => {
        setSessions(data.sessions || []);
        setStats(data.stats || null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
    // Restore scroll position from session detail back-navigation
    const savedScroll = sessionStorage.getItem("fleet-scroll");
    if (savedScroll) {
      requestAnimationFrame(() => window.scrollTo(0, parseInt(savedScroll, 10)));
      sessionStorage.removeItem("fleet-scroll");
    }
  }, []);

  // SSE for real-time updates
  useSSEConnection(
    {
      onAgentStatusChanged: () => {
        fetchData();
      },
      onStoryBlocked: () => {
        fetchData();
      },
    },
    { eventSourceFactory: () => new EventSource("/api/events") },
  );

  // Flash animation on data changes
  const flashTrigger = sessions ? [sessions.length] : [];
  const isFlashing = useFlashAnimation(flashTrigger);

  // Handler for row click — navigate to session detail
  const handleRowClick = (session: DashboardSession) => {
    sessionStorage.setItem("fleet-scroll", String(window.scrollY));
    router.push(`/sessions/${session.id}`);
  };

  if (loading) {
    return (
      <div className="text-[var(--color-text-muted)] text-sm p-8">Loading fleet status...</div>
    );
  }

  if (error) {
    return <div className="text-red-400 text-sm p-8">{error}</div>;
  }

  return (
    <div
      className={`p-6 transition-colors duration-300 ${isFlashing ? "bg-[rgba(59,130,246,0.05)]" : ""}`}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
          Fleet Monitoring
        </h1>
        {stats && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Total: {stats.total} | Active: {stats.active} | Idle: {stats.idle} | Blocked:{" "}
            {stats.blocked}
          </p>
        )}
      </div>

      <FleetMatrix sessions={sessions} onRowClick={handleRowClick} />
    </div>
  );
}
