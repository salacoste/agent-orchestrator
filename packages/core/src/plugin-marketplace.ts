/**
 * Plugin Marketplace — integrate with public plugin registry
 *
 * This service provides:
 * - Search and browse plugins from marketplace
 * - Install plugins from registry
 * - Plugin ratings and reviews
 * - Featured/recommended plugins
 * - Categories and tags
 */

import type { NpmPluginMetadata, NpmPluginDetails } from "./plugin-npm-registry.js";

/**
 * Plugin category
 */
export type PluginCategory =
  | "runtime"
  | "agent"
  | "workspace"
  | "tracker"
  | "scm"
  | "notifier"
  | "terminal"
  | "integration"
  | "utility";

/**
 * Plugin rating
 */
export interface PluginRating {
  /** Average rating (0-5) */
  average: number;
  /** Number of ratings */
  count: number;
  /** Rating distribution (key = rating value) */
  distribution?: Record<string, number>;
}

/**
 * Plugin review
 */
export interface PluginReview {
  /** Review ID */
  id: string;
  /** Reviewer name */
  reviewer: string;
  /** Rating (1-5) */
  rating: number;
  /** Review text */
  text: string;
  /** Review date */
  date: string;
  /** Plugin version reviewed */
  version?: string;
}

/**
 * Marketplace plugin listing
 */
export interface MarketplacePlugin {
  /** Package name */
  name: string;
  /** Latest version */
  version: string;
  /** Description */
  description?: string;
  /** Author */
  author?: string;
  /** Categories */
  categories: PluginCategory[];
  /** Tags */
  tags: string[];
  /** Rating */
  rating: PluginRating;
  /** Weekly downloads */
  downloads: number;
  /** Last updated */
  updatedAt: string;
  /** Featured status */
  featured: boolean;
  /** Verified publisher */
  verified: boolean;
  /** Homepage URL */
  homepage?: string;
  /** Repository URL */
  repository?: string;
  /** License */
  license?: string;
  /** Icon URL */
  icon?: string;
  /** Screenshots */
  screenshots?: string[];
}

/**
 * Marketplace search options
 */
export interface MarketplaceSearchOptions {
  /** Search query */
  query?: string;
  /** Filter by category */
  category?: PluginCategory;
  /** Filter by tag */
  tag?: string;
  /** Sort by: relevance, downloads, rating, recent */
  sortBy?: "relevance" | "downloads" | "rating" | "recent";
  /** Sort direction */
  sortDir?: "asc" | "desc";
  /** Include featured only */
  featured?: boolean;
  /** Include verified only */
  verified?: boolean;
  /** Maximum results */
  limit?: number;
}

/**
 * Marketplace search result
 */
export interface MarketplaceSearchResult {
  /** Plugins found */
  plugins: MarketplacePlugin[];
  /** Total count */
  total: number;
  /** Query used */
  query: string;
  /** Filters applied */
  filters: Record<string, unknown>;
}

/**
 * Plugin marketplace configuration
 */
export interface PluginMarketplaceConfig {
  /** Custom registry URL (optional) */
  registryUrl?: string;
  /** Cache TTL in seconds (default: 300) */
  cacheTtl?: number;
  /** Include prerelease versions */
  includePrerelease?: boolean;
}

/**
 * Plugin marketplace service interface
 */
export interface PluginMarketplace {
  /**
   * Search plugins in marketplace
   * @param options - Search options
   */
  search(options: MarketplaceSearchOptions): Promise<MarketplaceSearchResult>;

  /**
   * Get plugin details from marketplace
   * @param name - Plugin name
   */
  getPlugin(name: string): Promise<MarketplacePlugin | null>;

  /**
   * Get plugin reviews
   * @param name - Plugin name
   * @param limit - Maximum reviews to return
   */
  getReviews(name: string, limit?: number): Promise<PluginReview[]>;

  /**
   * Get featured plugins
   */
  getFeatured(): Promise<MarketplacePlugin[]>;

  /**
   * Get plugins by category
   * @param category - Plugin category
   * @param limit - Maximum plugins to return
   */
  getByCategory(category: PluginCategory, limit?: number): Promise<MarketplacePlugin[]>;

  /**
   * Get popular plugins
   * @param limit - Maximum plugins to return
   */
  getPopular(limit?: number): Promise<MarketplacePlugin[]>;

  /**
   * Get recently updated plugins
   * @param limit - Maximum plugins to return
   */
  getRecentlyUpdated(limit?: number): Promise<MarketplacePlugin[]>;

  /**
   * Get all available categories
   */
  getCategories(): PluginCategory[];

  /**
   * Get all available tags
   */
  getTags(): Promise<string[]>;

  /**
   * Clear cache
   */
  clearCache(): void;
}

/**
 * Built-in featured plugins
 */
const FEATURED_PLUGINS: string[] = [
  "@composio/ao-plugin-runtime-tmux",
  "@composio/ao-plugin-agent-claude-code",
  "@composio/ao-plugin-workspace-worktree",
  "@composio/ao-plugin-tracker-github",
  "@composio/ao-plugin-notifier-desktop",
];

/**
 * Mock ratings data for built-in plugins
 */
const MOCK_RATINGS: Record<string, PluginRating> = {
  "@composio/ao-plugin-runtime-tmux": { average: 4.8, count: 156 },
  "@composio/ao-plugin-runtime-process": { average: 4.5, count: 89 },
  "@composio/ao-plugin-agent-claude-code": { average: 4.9, count: 342 },
  "@composio/ao-plugin-agent-glm": { average: 4.6, count: 78 },
  "@composio/ao-plugin-agent-codex": { average: 4.4, count: 45 },
  "@composio/ao-plugin-agent-aider": { average: 4.3, count: 67 },
  "@composio/ao-plugin-workspace-worktree": { average: 4.7, count: 234 },
  "@composio/ao-plugin-workspace-clone": { average: 4.2, count: 56 },
  "@composio/ao-plugin-tracker-github": { average: 4.8, count: 289 },
  "@composio/ao-plugin-tracker-linear": { average: 4.6, count: 123 },
  "@composio/ao-plugin-scm-github": { average: 4.7, count: 198 },
  "@composio/ao-plugin-notifier-desktop": { average: 4.5, count: 167 },
  "@composio/ao-plugin-notifier-slack": { average: 4.4, count: 89 },
  "@composio/ao-plugin-terminal-iterm2": { average: 4.6, count: 134 },
};

/**
 * Extract category from plugin name
 */
function extractCategory(name: string): PluginCategory {
  if (name.includes("runtime-")) return "runtime";
  if (name.includes("agent-")) return "agent";
  if (name.includes("workspace-")) return "workspace";
  if (name.includes("tracker-")) return "tracker";
  if (name.includes("scm-")) return "scm";
  if (name.includes("notifier-")) return "notifier";
  if (name.includes("terminal-")) return "terminal";
  return "utility";
}

/**
 * Extract tags from plugin metadata
 */
function extractTags(plugin: NpmPluginMetadata): string[] {
  const tags = new Set<string>();

  // Add category as tag
  const category = extractCategory(plugin.name);
  tags.add(category);

  // Add keywords as tags
  if (plugin.keywords) {
    for (const keyword of plugin.keywords) {
      if (typeof keyword === "string" && !keyword.startsWith("ao-plugin")) {
        tags.add(keyword.toLowerCase());
      }
    }
  }

  return Array.from(tags);
}

/**
 * Plugin Marketplace Implementation
 */
class PluginMarketplaceImpl implements PluginMarketplace {
  private config: Required<Omit<PluginMarketplaceConfig, "registryUrl">> &
    Pick<PluginMarketplaceConfig, "registryUrl">;
  private cache: Map<string, { data: unknown; expiry: number }> = new Map();
  private searchPlugins: (query: string) => Promise<NpmPluginMetadata[]>;
  private getPluginDetails: (name: string) => Promise<NpmPluginDetails | null>;

  constructor(
    config: PluginMarketplaceConfig = {},
    deps: {
      searchPlugins: (query: string) => Promise<NpmPluginMetadata[]>;
      getPluginDetails: (name: string) => Promise<NpmPluginDetails | null>;
    },
  ) {
    this.config = {
      registryUrl: config.registryUrl,
      cacheTtl: config.cacheTtl ?? 300,
      includePrerelease: config.includePrerelease ?? false,
    };
    this.searchPlugins = deps.searchPlugins;
    this.getPluginDetails = deps.getPluginDetails;
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.config.cacheTtl * 1000,
    });
  }

  async search(options: MarketplaceSearchOptions = {}): Promise<MarketplaceSearchResult> {
    const {
      query = "",
      category,
      tag,
      sortBy = "relevance",
      sortDir = "desc",
      featured,
      verified,
      limit = 50,
    } = options;

    // Check cache
    const cacheKey = `search:${JSON.stringify(options)}`;
    const cached = this.getCached<MarketplaceSearchResult>(cacheKey);
    if (cached) return cached;

    // Search npm registry
    const npmResults = await this.searchPlugins(query || "ao-plugin");

    // Transform to marketplace plugins
    let plugins = npmResults.map((npm) => this.transformToMarketplacePlugin(npm));

    // Apply filters
    if (category) {
      plugins = plugins.filter((p) => p.categories.includes(category));
    }

    if (tag) {
      plugins = plugins.filter((p) => p.tags.includes(tag.toLowerCase()));
    }

    if (featured) {
      plugins = plugins.filter((p) => p.featured);
    }

    if (verified) {
      plugins = plugins.filter((p) => p.verified);
    }

    // Sort results
    plugins = this.sortPlugins(plugins, sortBy, sortDir);

    // Limit results
    const total = plugins.length;
    plugins = plugins.slice(0, limit);

    const result: MarketplaceSearchResult = {
      plugins,
      total,
      query,
      filters: { category, tag, featured, verified },
    };

    this.setCache(cacheKey, result);
    return result;
  }

  async getPlugin(name: string): Promise<MarketplacePlugin | null> {
    const cacheKey = `plugin:${name}`;
    const cached = this.getCached<MarketplacePlugin>(cacheKey);
    if (cached) return cached;

    const details = await this.getPluginDetails(name);
    if (!details) return null;

    const plugin = this.transformToMarketplacePlugin(details);
    this.setCache(cacheKey, plugin);
    return plugin;
  }

  async getReviews(_name: string, _limit = 10): Promise<PluginReview[]> {
    // Mock reviews for now - would integrate with a review service
    return [];
  }

  async getFeatured(): Promise<MarketplacePlugin[]> {
    const cacheKey = "featured";
    const cached = this.getCached<MarketplacePlugin[]>(cacheKey);
    if (cached) return cached;

    const plugins: MarketplacePlugin[] = [];

    for (const name of FEATURED_PLUGINS) {
      const plugin = await this.getPlugin(name);
      if (plugin) {
        plugins.push({ ...plugin, featured: true });
      }
    }

    this.setCache(cacheKey, plugins);
    return plugins;
  }

  async getByCategory(category: PluginCategory, limit = 20): Promise<MarketplacePlugin[]> {
    const result = await this.search({ category, limit, sortBy: "downloads" });
    return result.plugins;
  }

  async getPopular(limit = 20): Promise<MarketplacePlugin[]> {
    const result = await this.search({ sortBy: "downloads", limit });
    return result.plugins;
  }

  async getRecentlyUpdated(limit = 20): Promise<MarketplacePlugin[]> {
    const result = await this.search({ sortBy: "recent", limit });
    return result.plugins;
  }

  getCategories(): PluginCategory[] {
    return [
      "runtime",
      "agent",
      "workspace",
      "tracker",
      "scm",
      "notifier",
      "terminal",
      "integration",
      "utility",
    ];
  }

  async getTags(): Promise<string[]> {
    const result = await this.search({ limit: 100 });
    const tags = new Set<string>();

    for (const plugin of result.plugins) {
      for (const tag of plugin.tags) {
        tags.add(tag);
      }
    }

    return Array.from(tags).sort();
  }

  clearCache(): void {
    this.cache.clear();
  }

  private transformToMarketplacePlugin(npm: NpmPluginMetadata): MarketplacePlugin {
    const category = extractCategory(npm.name);
    const tags = extractTags(npm);
    const rating = MOCK_RATINGS[npm.name] ?? { average: 0, count: 0 };

    return {
      name: npm.name,
      version: npm.version,
      description: npm.description,
      author: npm.author,
      categories: [category],
      tags,
      rating,
      downloads: npm.downloads ?? 0,
      updatedAt: npm.date ?? new Date().toISOString(),
      featured: FEATURED_PLUGINS.includes(npm.name),
      verified: npm.name.startsWith("@composio/"),
      homepage: npm.homepage,
      repository: npm.repository,
      license: npm.license,
    };
  }

  private sortPlugins(
    plugins: MarketplacePlugin[],
    sortBy: string,
    sortDir: string,
  ): MarketplacePlugin[] {
    const multiplier = sortDir === "desc" ? -1 : 1;

    return [...plugins].sort((a, b) => {
      switch (sortBy) {
        case "downloads":
          return multiplier * (a.downloads - b.downloads);
        case "rating":
          return multiplier * (a.rating.average - b.rating.average);
        case "recent":
          return multiplier * (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        case "relevance":
        default:
          // Featured first, then by downloads
          if (a.featured !== b.featured) {
            return a.featured ? -1 : 1;
          }
          return multiplier * (a.downloads - b.downloads);
      }
    });
  }
}

/**
 * Create a plugin marketplace service
 */
export function createPluginMarketplace(
  config: PluginMarketplaceConfig,
  deps: {
    searchPlugins: (query: string) => Promise<NpmPluginMetadata[]>;
    getPluginDetails: (name: string) => Promise<NpmPluginDetails | null>;
  },
): PluginMarketplace {
  return new PluginMarketplaceImpl(config, deps);
}
