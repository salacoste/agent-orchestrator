"use client";

import { use } from "react";
import { ConflictHistoryTable } from "@/components/ConflictHistoryTable";

interface ConflictsPageProps {
  params: Promise<{ project: string }>;
}

export default function ConflictsPage({ params }: ConflictsPageProps) {
  const { project: projectId } = use(params);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Conflict History</h1>
        <p className="mt-2 text-sm text-gray-600">
          View and analyze agent assignment conflicts, their resolutions, and patterns over time.
        </p>
      </div>

      <ConflictHistoryTable projectId={projectId} />
    </div>
  );
}
