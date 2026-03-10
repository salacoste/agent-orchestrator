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

interface ConflictSummary {
  total: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byType: {
    "duplicate-assignment": number;
  };
}

interface ConflictsResponse {
  conflicts: Conflict[];
  summary: ConflictSummary;
}

interface ConflictHistoryTableProps {
  projectId: string;
}

export function ConflictHistoryTable({ projectId }: ConflictHistoryTableProps) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [summary, setSummary] = useState<ConflictSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recency" | "frequency">("recency");
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | null>(null);

  const fetchConflicts = async (sort: "recency" | "frequency" = sortBy) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sprint/${projectId}/conflicts?sort=${sort}`);
      if (!response.ok) {
        throw new Error("Failed to fetch conflicts");
      }
      const data: ConflictsResponse = await response.json();
      setConflicts(data.conflicts);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, [projectId]);

  const handleSortChange = (sort: "recency" | "frequency") => {
    setSortBy(sort);
    fetchConflicts(sort);
  };

  const handleExport = (format: "csv" | "json") => {
    setExportFormat(format);
  };

  useEffect(() => {
    if (exportFormat) {
      window.open(
        `/api/sprint/${projectId}/conflicts?sort=${sortBy}&export=${exportFormat}`,
        "_blank",
      );
      setExportFormat(null);
    }
  }, [exportFormat, projectId, sortBy]);

  const getSeverityColor = (severity: Conflict["severity"]) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-red-50 text-red-700 border-red-200";
      case "medium":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getSeverityBadge = (severity: Conflict["severity"]) => {
    switch (severity) {
      case "critical":
        return "CRITICAL";
      case "high":
        return "HIGH";
      case "medium":
        return "MEDIUM";
      case "low":
        return "LOW";
      default:
        return severity.toUpperCase();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm text-gray-500">Total Conflicts</div>
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm text-gray-500">Critical/High</div>
            <div className="text-2xl font-bold text-red-600">
              {summary.bySeverity.critical + summary.bySeverity.high}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm text-gray-500">Medium</div>
            <div className="text-2xl font-bold text-yellow-600">{summary.bySeverity.medium}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm text-gray-500">Low</div>
            <div className="text-2xl font-bold text-green-600">{summary.bySeverity.low}</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as "recency" | "frequency")}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="recency">Most Recent</option>
            <option value="frequency">Most Frequent</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Conflicts Table */}
      {conflicts.length === 0 ? (
        <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm text-center">
          <p className="text-gray-500">No conflicts detected</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Conflict ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Story
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Existing Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Conflicting Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detected
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resolution
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {conflicts.map((conflict) => (
                <tr key={conflict.conflictId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {conflict.conflictId.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {conflict.storyId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {conflict.existingAgent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {conflict.conflictingAgent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full border ${getSeverityColor(conflict.severity)}`}
                    >
                      {getSeverityBadge(conflict.severity)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDistanceToNow(new Date(conflict.detectedAt), {
                      addSuffix: true,
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {conflict.resolution ? (
                      <span className="text-green-600">{conflict.resolution.resolution}</span>
                    ) : (
                      <span className="text-yellow-600">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedConflict(conflict)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                          {formatDistanceToNow(new Date(selectedConflict.resolution.resolvedAt), {
                            addSuffix: true,
                          })}
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
