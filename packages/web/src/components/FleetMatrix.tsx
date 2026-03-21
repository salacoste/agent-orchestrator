"use client";

/**
 * FleetMatrix — Row-based agent monitoring table.
 *
 * Replaces the Kanban card layout with an htop-style matrix showing:
 * Agent ID | Story | Status | Duration | Last Activity
 *
 * Features: keyboard navigation (j/k/Enter), status badges, responsive.
 */

import { useState, useEffect, useCallback } from "react";
import type { DashboardSession } from "@/lib/types";
import { formatDuration, formatTimeAgo, getStatusInfo, getSessionTitle } from "@/lib/format";

interface FleetMatrixProps {
  sessions: DashboardSession[];
  onRowClick?: (session: DashboardSession) => void;
}

export function FleetMatrix({ sessions, onRowClick }: FleetMatrixProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Keyboard navigation: j=down, k=up, Enter=open
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (sessions.length === 0) return;
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, sessions.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        onRowClick?.(sessions[selectedIndex]);
      }
    },
    [sessions, selectedIndex, onRowClick],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Clamp selection when sessions list changes
  useEffect(() => {
    if (selectedIndex >= sessions.length) {
      setSelectedIndex(sessions.length > 0 ? sessions.length - 1 : -1);
    }
  }, [sessions.length, selectedIndex]);

  // Empty state
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <p className="text-lg mb-2">No active agents</p>
        <p className="text-sm">
          Use <code className="bg-gray-800 px-2 py-0.5 rounded text-green-400">ao spawn</code> to
          start one.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left" role="grid" aria-label="Agent Fleet Matrix">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wider">
            <th scope="col" className="px-4 py-3 font-medium">
              Agent
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Story
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Duration
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Last Activity
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session, index) => {
            const status = getStatusInfo(session.activity);
            const isSelected = index === selectedIndex;

            return (
              <tr
                key={session.id}
                role="row"
                tabIndex={0}
                aria-selected={isSelected}
                className={`border-b border-gray-800 cursor-pointer transition-colors ${
                  isSelected ? "bg-gray-700 ring-1 ring-blue-500" : "hover:bg-gray-800/50"
                }`}
                onClick={() => {
                  setSelectedIndex(index);
                  onRowClick?.(session);
                }}
              >
                <td className="px-4 py-3 font-mono text-white">{session.id}</td>
                <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                  {session.issueLabel ? (
                    <span>
                      <span className="text-blue-400 font-medium">{session.issueLabel}</span>
                      {session.issueTitle && (
                        <span className="ml-2 text-gray-500">{session.issueTitle}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-500">{getSessionTitle(session)}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 ${status.color}`}
                    aria-label={`Status: ${status.label}`}
                  >
                    <span aria-hidden="true">{status.emoji}</span>
                    <span className="text-xs">{status.label}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                  {formatDuration(session.createdAt)}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {formatTimeAgo(session.lastActivityAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Keyboard hint */}
      <div className="mt-2 px-4 text-xs text-gray-600">
        <kbd className="bg-gray-800 px-1 rounded">j</kbd>/
        <kbd className="bg-gray-800 px-1 rounded">k</kbd> navigate{" "}
        <kbd className="bg-gray-800 px-1 rounded">Enter</kbd> open
      </div>
    </div>
  );
}
