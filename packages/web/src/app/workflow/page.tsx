import type { Metadata } from "next";

import { WorkflowPage } from "@/components/WorkflowPage";
import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return { title: { absolute: "ao | Workflow" } };
}

export default async function WorkflowRoute() {
  let projectIds: string[] = [];
  try {
    const { config } = await getServices();
    projectIds = Object.keys(config.projects || {});
  } catch {
    // Config not found or services unavailable — render with empty project list
  }

  return <WorkflowPage projects={projectIds} />;
}
