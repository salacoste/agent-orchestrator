"use client";

import { useEffect } from "react";
import type { ResourceConflict } from "@composio/ao-core";
import { ConflictSeverityBadge } from "./ConflictSeverityBadge";
import { ConflictSuggestionsList } from "./ConflictSuggestionsList";

interface ConflictDetailPanelProps {
  conflict: ResourceConflict;
  onClose: () => void;
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  repository: "Repository",
  "file-path": "File Path",
  agent: "Agent",
  "external-service": "External Service",
};

export function ConflictDetailPanel({ conflict, onClose }: ConflictDetailPanelProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Slide-over panel */}
      <div
        className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Conflict Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded p-1"
              aria-label="Close detail panel"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Severity badge */}
          <div className="mb-4">
            <ConflictSeverityBadge severity={conflict.severity} />
          </div>

          {/* Resource type */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Resource Type
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {RESOURCE_TYPE_LABELS[conflict.resourceType] ?? conflict.resourceType}
            </p>
          </div>

          {/* Resource identifier */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Resource Identifier
            </label>
            <p className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 rounded px-3 py-2 break-all">
              {conflict.resourceIdentifier}
            </p>
          </div>

          {/* Competing projects */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Competing Projects ({conflict.competingProjects.length})
            </label>
            <div className="mt-2 space-y-1">
              {conflict.competingProjects.map((projectId) => (
                <div
                  key={projectId}
                  className="text-sm font-mono bg-gray-50 rounded px-3 py-1.5 text-gray-700"
                >
                  {projectId}
                </div>
              ))}
            </div>
          </div>

          {/* Detected at */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Detected At
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(conflict.detectedAt).toLocaleString()}
            </p>
          </div>

          {/* Metadata */}
          {conflict.metadata && Object.keys(conflict.metadata).length > 0 && (
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Metadata
              </label>
              <div className="mt-2 bg-gray-50 rounded px-3 py-2">
                {Object.entries(conflict.metadata).map(([key, value]) => (
                  <div key={key} className="text-sm text-gray-700">
                    <span className="font-medium">{key}:</span> {String(value)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution Suggestions */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Resolution Suggestions
            </label>
            <div className="mt-2">
              <ConflictSuggestionsList conflictId={conflict.id} />
            </div>
          </div>

          {/* Conflict ID */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Conflict ID
            </label>
            <p className="mt-1 text-xs text-gray-400 font-mono break-all">{conflict.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
