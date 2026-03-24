/**
 * User identity — config-based authentication (Story 46b.1).
 *
 * Pure functions. No passwords, no tokens — trust-based identity
 * for small teams using config-declared users.
 */

/** User role enum. */
export type AuthRole = "admin" | "lead" | "dev" | "viewer";

/** Configured user. */
export interface ConfigUser {
  id: string;
  name: string;
  role: AuthRole;
  email?: string;
}

/** Anonymous default user. */
export const ANONYMOUS_USER: ConfigUser = {
  id: "anonymous",
  name: "Anonymous",
  role: "admin",
};

/**
 * Resolve a user by ID from the configured users list.
 * Returns the matching user or ANONYMOUS_USER if not found.
 */
export function resolveUser(userId: string | null, users: ConfigUser[]): ConfigUser {
  if (!userId) return ANONYMOUS_USER;
  return users.find((u) => u.id === userId) ?? ANONYMOUS_USER;
}

/**
 * Validate a user role has sufficient permissions.
 * Role hierarchy: admin > lead > dev > viewer.
 */
export function hasPermission(userRole: AuthRole, requiredRole: AuthRole): boolean {
  const hierarchy: Record<AuthRole, number> = {
    viewer: 0,
    dev: 1,
    lead: 2,
    admin: 3,
  };
  return hierarchy[userRole] >= hierarchy[requiredRole];
}
