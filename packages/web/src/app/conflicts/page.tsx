import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import {
  checkResourceConflicts,
  createResourceConflictStore,
  type ResourceConflict,
} from "@composio/ao-core";
import { ConflictAlertDashboard } from "@/components/ConflictAlertDashboard";
import { ConflictsPageClient } from "./client";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: "ao | Conflicts" } };
}

export default async function ConflictsPage() {
  let conflicts: ResourceConflict[] = [];
  let scanDurationMs = 0;

  try {
    const { config } = await getServices();
    const store = createResourceConflictStore(config.configPath);
    const result = checkResourceConflicts(config, store);
    conflicts = result.conflicts;
    scanDurationMs = result.scanDurationMs;
  } catch (error) {
    console.error("[ConflictsPage] Failed to load conflicts:", error);
  }

  return (
    <ConflictsPageClient>
      <ConflictAlertDashboard initialConflicts={conflicts} scanDurationMs={scanDurationMs} />
    </ConflictsPageClient>
  );
}
