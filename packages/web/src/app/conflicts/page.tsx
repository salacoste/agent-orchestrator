"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

interface PriorityScores {
  [agentId: string]: number;
}

interface ConflictResolution {
  resolution: string;
  resolvedAt?: string;
}

interface Conflict {
  conflictId: string;
  storyId: string;
  existingAgent: string;
  conflictingAgent: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  detectedAt: string;
  priorityScores: PriorityScores;
  recommendations: string[];
  resolution: ConflictResolution | null;
}

interface ResolutionResult {
  conflictId: string;
  action: string;
  keptAgent: string | null;
  terminatedAgent: string | null;
  reason: string;
  resolvedAt: string;
}

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<Record<string, string>>({});
  const [resolutionResults, setResolutionResults] = useState<ResolutionResult[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);

  const fetchConflicts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/conflicts");
      if (!response.ok) {
        throw new Error("Failed to fetch conflicts");
      }
      const data = await response.json();
      setConflicts(data.conflicts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConflicts();
    // Refresh conflicts every 30 seconds
    const interval = setInterval(() => {
      void fetchConflicts();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (conflictId: string) => {
    const action = selectedAction[conflictId] || "keep-existing";
    setResolving(conflictId);

    try {
      const response = await fetch(`/api/conflicts/${conflictId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (data.success) {
        // Update conflict in list
        setConflicts((prev) =>
          prev.map((c) =>
            c.conflictId === conflictId
              ? {
                  ...c,
                  resolution: {
                    resolution: action,
                    resolvedAt: data.resolution.resolvedAt,
                  },
                }
              : c,
          ),
        );
        setResolutionResults((prev) => [...prev, data.resolution]);
      } else {
        console.error("Failed to resolve conflict:", data.error);
      }
    } catch (err) {
      console.error("Error resolving conflict:", err);
    } finally {
      setResolving(null);
    }
  };

  const getSeverityColor = (severity: Conflict["severity"]) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const unresolvedConflicts = conflicts.filter((c) => !c.resolution);
  const resolvedConflicts = conflicts.filter((c) => c.resolution);

  if (loading && conflicts.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Conflict Resolution</h1>
        <p className="mt-2 text-sm text-gray-600">
          View, analyze, and resolve agent assignment conflicts across all projects.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={() => void fetchConflicts()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500">Total Conflicts</div>
          <div className="text-2xl font-bold text-gray-900">{conflicts.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500">Pending Resolution</div>
          <div className="text-2xl font-bold text-orange-600">{unresolvedConflicts.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500">Resolved</div>
          <div className="text-2xl font-bold text-green-600">{resolvedConflicts.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500">Critical/High</div>
          <div className="text-2xl font-bold text-red-600">
            {conflicts.filter((c) => c.severity === "critical" || c.severity === "high").length}
          </div>
        </div>
      </div>

      {/* Active Conflicts */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Active Conflicts ({unresolvedConflicts.length})
        </h2>
        {unresolvedConflicts.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
            No active conflicts
          </div>
        ) : (
          <div className="space-y-4">
            {unresolvedConflicts.map((conflict) => (
              <div key={conflict.conflictId} className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded border ${getSeverityColor(conflict.severity)}`}
                      >
                        {conflict.severity.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {conflict.type.replace(/-/g, " ")}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1">{conflict.storyId}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">{conflict.existingAgent}</span> vs{" "}
                      <span className="font-medium">{conflict.conflictingAgent}</span>
                    </p>
                    <div className="flex gap-4 text-xs text-gray-500 mb-3">
                      <span>
                        Priority:{" "}
                        {conflict.priorityScores[conflict.existingAgent]?.toFixed(2) ?? "N/A"} vs{" "}
                        {conflict.priorityScores[conflict.conflictingAgent]?.toFixed(2) ?? "N/A"}
                      </span>
                      <span>
                        Detected: {formatDistanceToNow(new Date(conflict.detectedAt))} ago
                      </span>
                    </div>
                    {conflict.recommendations.length > 0 && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Recommendations:</span>
                        <ul className="list-disc list-inside mt-1">
                          {conflict.recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 w-48">
                    <select
                      value={selectedAction[conflict.conflictId] || "keep-existing"}
                      onChange={(e) =>
                        setSelectedAction((prev) => ({
                          ...prev,
                          [conflict.conflictId]: e.target.value,
                        }))
                      }
                      className="w-full text-sm border rounded px-2 py-1 mb-2"
                      disabled={resolving === conflict.conflictId}
                    >
                      <option value="keep-existing">Keep Existing</option>
                      <option value="replace-with-new">Replace with New</option>
                      <option value="manual">Manual Review</option>
                    </select>
                    <button
                      onClick={() => void handleResolve(conflict.conflictId)}
                      disabled={resolving === conflict.conflictId}
                      className="w-full bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {resolving === conflict.conflictId ? "Resolving..." : "Resolve"}
                    </button>
                    <button
                      onClick={() => setSelectedConflict(conflict)}
                      className="w-full mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recently Resolved */}
      {resolvedConflicts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recently Resolved ({resolvedConflicts.length})
          </h2>
          <div className="space-y-2">
            {resolvedConflicts.map((conflict) => (
              <div
                key={conflict.conflictId}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{conflict.storyId}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      Resolved: {conflict.resolution?.resolution}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {conflict.resolution?.resolvedAt
                      ? formatDistanceToNow(new Date(conflict.resolution.resolvedAt)) + " ago"
                      : "N/A"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolution Results */}
      {resolutionResults.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Resolution Results</h2>
          <div className="space-y-2">
            {resolutionResults.map((result) => (
              <div
                key={result.conflictId}
                className="bg-green-50 border border-green-200 rounded-lg p-3"
              >
                <div className="text-sm">
                  <span className="font-medium">{result.conflictId}</span>: {result.reason}
                  {result.keptAgent && (
                    <span className="text-green-700 ml-2">(Kept: {result.keptAgent})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={() => void fetchConflicts()}
          disabled={loading}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400"
        >
          {loading ? "Refreshing..." : "Refresh Conflicts"}
        </button>
      </div>

      {/* Conflict Detail Modal */}
      {selectedConflict && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedConflict(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Conflict Details</h3>
                <button
                  onClick={() => setSelectedConflict(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Conflict ID</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">
                    {selectedConflict.conflictId}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Story ID</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedConflict.storyId}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Existing Agent</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono">
                      {selectedConflict.existingAgent}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Conflicting Agent</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono">
                      {selectedConflict.conflictingAgent}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Priority Scores</label>
                  <div className="mt-2 space-y-1">
                    {Object.entries(selectedConflict.priorityScores).map(([agentId, score]) => (
                      <div
                        key={agentId}
                        className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
                      >
                        <span className="text-sm text-gray-900 font-mono">{agentId}</span>
                        <span className="text-sm font-medium">{(score * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedConflict.recommendations.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Recommendations</label>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      {selectedConflict.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-gray-600">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedConflict.resolution && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Resolution</label>
                    <div className="mt-2 bg-green-50 border border-green-200 rounded-md p-3">
                      <p className="text-sm font-medium text-green-800">
                        {selectedConflict.resolution.resolution}
                      </p>
                      {selectedConflict.resolution.resolvedAt && (
                        <p className="text-xs text-green-600 mt-1">
                          Resolved:{" "}
                          {formatDistanceToNow(new Date(selectedConflict.resolution.resolvedAt))}{" "}
                          ago
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
