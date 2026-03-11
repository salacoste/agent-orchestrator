/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@composio/ao-core"],
  webpack: (config, { isServer, webpack: wp }) => {
    if (isServer) {
      // Suppress "Critical dependency" warnings from plugin-registry's dynamic import().
      // Scoped to ao-core only — other packages still get normal warnings.
      config.module.rules.push({
        test: /plugin-registry\.js$/,
        parser: { exprContextCritical: false },
      });

      // Ignore optional peer dependency @composio/core (Composio SDK)
      // used by tracker-linear — only loaded at runtime if configured
      config.plugins.push(
        new wp.IgnorePlugin({
          resourceRegExp: /^@composio\/core$/,
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
