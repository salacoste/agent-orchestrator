import type {
  PluginModule,
  PluginManifest,
  SessionEnhancementProvider,
  ProviderConfig,
  StoryContext,
  ProviderHealth,
  Session,
} from "@composio/ao-core";

export const manifest = {
  name: "raw",
  slot: "provider" as const,
  description: "Provider plugin: no-op raw provider (default)",
  version: "0.1.0",
} satisfies PluginManifest;

export function create(): SessionEnhancementProvider {
  return {
    name: "raw",

    async install(_worktreePath: string, _config: ProviderConfig): Promise<void> {
      // No-op — raw provider does not modify the workspace.
    },

    async configure(_worktreePath: string, _context: StoryContext): Promise<void> {
      // No-op — raw provider does not configure story context.
    },

    async enhance(session: Session): Promise<Session> {
      // No-op — return session unchanged.
      return session;
    },

    async teardown(_worktreePath: string): Promise<void> {
      // No-op — nothing to clean up.
    },

    async healthCheck(): Promise<ProviderHealth> {
      return {
        healthy: true,
        lastCheck: new Date(),
      };
    },
  };
}

export default { manifest, create } satisfies PluginModule<SessionEnhancementProvider>;
