"use client";

/**
 * LearningInsightsPanel — Shows agent learning insights in the dashboard.
 *
 * Displays: total sessions, success rate trend, top failure patterns.
 * Renders independently with graceful empty state (LKG pattern).
 */

interface LearningInsight {
  totalSessions: number;
  successRate: number;
  failureRate: number;
  topPatterns: Array<{ category: string; count: number }>;
}

interface LearningInsightsPanelProps {
  data?: LearningInsight | null;
}

export function LearningInsightsPanel({ data }: LearningInsightsPanelProps) {
  // Empty state
  if (!data || data.totalSessions === 0) {
    return (
      <div className="border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Learning Insights</h3>
        <p className="text-xs text-gray-600">
          No learning data yet. Insights will appear after agents complete stories.
        </p>
      </div>
    );
  }

  const successPct = Math.round(data.successRate * 100);

  return (
    <div className="border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Learning Insights</h3>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-2xl font-bold text-white">{data.totalSessions}</div>
          <div className="text-xs text-gray-500">Total Sessions</div>
        </div>
        <div>
          <div
            className={`text-2xl font-bold ${successPct >= 80 ? "text-green-400" : successPct >= 50 ? "text-yellow-400" : "text-red-400"}`}
          >
            {successPct}%
          </div>
          <div className="text-xs text-gray-500">Success Rate</div>
        </div>
      </div>

      {data.topPatterns.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Top Failure Patterns</div>
          {data.topPatterns.slice(0, 3).map((p) => (
            <div key={p.category} className="flex justify-between text-xs py-0.5">
              <span className="text-red-400 truncate">{p.category}</span>
              <span className="text-gray-500 ml-2">{p.count}x</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
