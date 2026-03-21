import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const FEEDBACK_FILENAME = ".recommendation-feedback.jsonl";

function getFeedbackPath(): string {
  const projectRoot = process.cwd();
  return path.join(projectRoot, "_bmad-output", FEEDBACK_FILENAME);
}

/**
 * GET /api/workflow/feedback — Read all feedback entries (Story 25a.2)
 */
export async function GET(): Promise<NextResponse> {
  try {
    const feedbackPath = getFeedbackPath();
    if (!existsSync(feedbackPath)) {
      return NextResponse.json({ entries: [] });
    }

    const content = await readFile(feedbackPath, "utf-8");
    const entries = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json({ entries });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/workflow/feedback — Record a feedback entry (Story 25a.2)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    if (!body.phase || !body.action || !body.timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: phase, action, timestamp" },
        { status: 400 },
      );
    }

    const feedbackPath = getFeedbackPath();
    const dir = path.dirname(feedbackPath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const line = JSON.stringify(body) + "\n";
    await writeFile(feedbackPath, line, { flag: "a" });

    return NextResponse.json({ success: true });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
