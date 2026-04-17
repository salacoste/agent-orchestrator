"use client";

import { useState, type ReactNode } from "react";
import { ConflictHistoryView } from "@/components/ConflictHistoryView";
import { ConflictPolicyPanel } from "@/components/ConflictPolicyPanel";

type Tab = "active" | "history" | "policies";

export function ConflictsPageClient({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>("active");

  return (
    <div className="px-8 py-7">
      {/* Tab header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Resource Conflicts</h1>
        <div className="mt-3 flex gap-1 border-b border-gray-200">
          <TabButton active={activeTab === "active"} onClick={() => setActiveTab("active")}>
            Active Conflicts
          </TabButton>
          <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>
            History
          </TabButton>
          <TabButton active={activeTab === "policies"} onClick={() => setActiveTab("policies")}>
            Policies
          </TabButton>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "active" && children}
      {activeTab === "history" && <ConflictHistoryView />}
      {activeTab === "policies" && <ConflictPolicyPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}
