import { NextResponse, type NextRequest } from "next/server";

import { getServices } from "@/lib/services";
import { aggregateProjectContext } from "@/lib/workflow/project-context-aggregator";

export const dynamic = "force-dynamic";

/** Anthropic Messages API endpoint. */
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/** Default model for project chat. */
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * POST /api/chat — Project chat with LLM (Story 40.4)
 *
 * Accepts a question, builds project context as system prompt,
 * calls the Anthropic Messages API, and returns the answer.
 * Falls back gracefully when no API key is configured.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse question from request body
    const body = (await request.json()) as Record<string, unknown>;
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json({ answer: "", error: "Question is required" }, { status: 400 });
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        answer:
          "Project chat requires an Anthropic API key. " +
          "Set the ANTHROPIC_API_KEY environment variable to enable LLM-powered answers. " +
          "In the meantime, check the dashboard panels for project insights.",
        fallback: true,
      });
    }

    // Build project context from real session data
    let storiesDone = 0;
    let storiesTotal = 0;
    let activeAgents = 0;
    try {
      const { sessionManager } = await getServices();
      const sessions = await sessionManager.list();
      storiesTotal = sessions.length;
      storiesDone = sessions.filter((s) => s.status === "merged" || s.status === "cleanup").length;
      activeAgents = sessions.filter((s) => s.status === "working").length;
    } catch {
      // Services unavailable — proceed with zero context
    }
    const context = aggregateProjectContext([], [], storiesDone, storiesTotal, activeAgents);

    // Call Anthropic Messages API with 30s timeout
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 30_000);

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          max_tokens: 1024,
          system: `You are a helpful project assistant for an agent orchestrator dashboard. ${context.fullContext}`,
          messages: [{ role: "user", content: question }],
        }),
        signal: abortController.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Log full error server-side, return generic message to client
      const errorText = await response.text().catch(() => "unknown");
      // eslint-disable-next-line no-console
      console.error(`[chat] Anthropic API error (${response.status}):`, errorText);
      return NextResponse.json({
        answer: `LLM request failed (${response.status}). Check your API key and try again.`,
        fallback: true,
      });
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text: string }>;
    };

    const answer = data.content?.find((c) => c.type === "text")?.text ?? "No response from LLM.";

    return NextResponse.json({ answer });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json(
      { answer: "Chat temporarily unavailable.", error: error.message, fallback: true },
      { status: 200 },
    );
  }
}
