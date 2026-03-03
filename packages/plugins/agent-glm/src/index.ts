import type { Agent, PluginModule } from "@composio/ao-core";
import {
  createClaudeCompatibleAgent,
  type ClaudeCompatibleAgentOptions,
} from "@composio/ao-plugin-agent-claude-code";

export const manifest = {
  name: "glm",
  slot: "agent" as const,
  description: "Agent plugin: Z.ai GLM via yolo",
  version: "0.1.0",
};

const OPTIONS: ClaudeCompatibleAgentOptions = {
  name: manifest.name,
  description: manifest.description,
  defaultCommand: "yolo -api",
  defaultProcessName: "yolo",
};

export function create(): Agent {
  return createClaudeCompatibleAgent(OPTIONS);
}

export default { manifest, create } satisfies PluginModule<Agent>;
