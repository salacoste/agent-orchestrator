/**
 * Agent Orchestrator GitHub Action (Story 35.3).
 *
 * Spawn agents, check status, get recommendations from CI/CD.
 */

// GitHub Actions toolkit types (would use @actions/core in production)
interface ActionCore {
  getInput(name: string): string;
  setOutput(name: string, value: string): void;
  setFailed(message: string): void;
  info(message: string): void;
}

/** Fetch timeout for API calls (30 seconds). */
const FETCH_TIMEOUT_MS = 30_000;

/** Fetch with timeout via AbortController. */
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function run(core: ActionCore): Promise<void> {
  try {
    const command = core.getInput("command");
    const aoUrl = core.getInput("ao-url");
    const apiKey = core.getInput("ao-api-key");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    switch (command) {
      case "spawn": {
        const storyId = core.getInput("story-id");
        if (!storyId) {
          core.setFailed("story-id is required for spawn command");
          return;
        }
        const res = await fetchWithTimeout(`${aoUrl}/api/sessions`, {
          method: "POST",
          headers,
          body: JSON.stringify({ storyId }),
        });
        if (!res.ok) {
          core.setFailed(`Spawn failed: API returned ${res.status}`);
          return;
        }
        const data = (await res.json()) as { sessionId: string };
        core.setOutput("session-id", data.sessionId);
        core.info(`Spawned agent ${data.sessionId} for story ${storyId}`);
        break;
      }

      case "recommend": {
        const projectId = core.getInput("project-id");
        const res = await fetchWithTimeout(`${aoUrl}/api/workflow/${projectId}`, { headers });
        if (!res.ok) {
          core.setFailed(`Recommend failed: API returned ${res.status}`);
          return;
        }
        const data = (await res.json()) as { recommendation: unknown };
        core.setOutput("recommendation", JSON.stringify(data.recommendation));
        core.info(`Recommendation: ${JSON.stringify(data.recommendation)}`);
        break;
      }

      case "status": {
        const projectId = core.getInput("project-id");
        const res = await fetchWithTimeout(`${aoUrl}/api/workflow/${projectId}`, { headers });
        if (!res.ok) {
          core.setFailed(`Status failed: API returned ${res.status}`);
          return;
        }
        const data = (await res.json()) as { phases: unknown[] };
        core.setOutput("status", JSON.stringify(data.phases));
        core.info(`Status: ${JSON.stringify(data.phases)}`);
        break;
      }

      default:
        core.setFailed(`Unknown command: ${command}. Use: spawn, status, recommend`);
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export { run };
