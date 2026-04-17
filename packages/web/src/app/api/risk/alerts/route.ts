/**
 * GET /api/risk/alerts — Return active and recently-acknowledged risk alerts.
 *
 * Story 56.5 Task 5.
 */

import { NextResponse } from "next/server";
import { getActiveAlerts, getAllAlerts, acknowledgeAlert } from "@/lib/risk-alert-broadcaster";
import { getAlertConfig } from "@/lib/risk-alert-config";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const activeAlerts = getActiveAlerts();
  const allAlerts = getAllAlerts();

  // Recently acknowledged = acknowledged within the full in-memory list
  const recentAcknowledged = allAlerts.filter((a) => a.acknowledged);

  return NextResponse.json({
    activeAlerts,
    recentAcknowledged,
    config: getAlertConfig(),
  });
}

export async function PATCH(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const { alertId, action } = body as { alertId?: string; action?: string };
  if (!alertId || typeof alertId !== "string") {
    return NextResponse.json({ error: "alertId is required" }, { status: 400 });
  }
  if (action !== "acknowledge") {
    return NextResponse.json({ error: "action must be 'acknowledge'" }, { status: 400 });
  }

  const found = acknowledgeAlert(alertId);
  if (!found) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, alertId });
}
