/**
 * Widget Registry — Role-based dashboard layout (Story 44.1).
 *
 * Maps widget IDs to display configuration and defines
 * role-specific default layouts for the dashboard grid.
 */

/** Available dashboard widget identifiers. */
export type WidgetId =
  | "phaseBar"
  | "cascadeAlert"
  | "antiPatterns"
  | "recommendation"
  | "agents"
  | "artifacts"
  | "lastActivity"
  | "costPanel"
  | "conflictPanel"
  | "chatPanel";

/** User roles for dashboard layout. */
export type UserRole = "dev" | "pm" | "lead" | "admin";

/** Experience level for progressive disclosure (Story 44.5). */
export type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "expert";

/** Widget metadata. */
export interface WidgetMeta {
  id: WidgetId;
  label: string;
  /** Grid column span (1 or 3 for full-width). */
  colSpan: 1 | 3;
  /** Minimum experience level to show this widget. */
  minLevel: ExperienceLevel;
}

/** Widget metadata registry. */
export const WIDGET_META: Record<WidgetId, WidgetMeta> = {
  phaseBar: { id: "phaseBar", label: "Phase Pipeline", colSpan: 3, minLevel: "beginner" },
  cascadeAlert: { id: "cascadeAlert", label: "Cascade Alert", colSpan: 3, minLevel: "beginner" },
  antiPatterns: {
    id: "antiPatterns",
    label: "Anti-Pattern Nudges",
    colSpan: 3,
    minLevel: "intermediate",
  },
  recommendation: { id: "recommendation", label: "AI Guide", colSpan: 1, minLevel: "beginner" },
  agents: { id: "agents", label: "Agents", colSpan: 1, minLevel: "beginner" },
  artifacts: { id: "artifacts", label: "Artifacts", colSpan: 1, minLevel: "intermediate" },
  lastActivity: {
    id: "lastActivity",
    label: "Last Activity",
    colSpan: 1,
    minLevel: "intermediate",
  },
  costPanel: { id: "costPanel", label: "Cost & Schedule", colSpan: 1, minLevel: "intermediate" },
  conflictPanel: { id: "conflictPanel", label: "Conflicts", colSpan: 1, minLevel: "advanced" },
  chatPanel: { id: "chatPanel", label: "Project Chat", colSpan: 3, minLevel: "advanced" },
};

/** Default widget layouts per role. */
export const ROLE_LAYOUTS: Record<UserRole, WidgetId[]> = {
  dev: [
    "phaseBar",
    "cascadeAlert",
    "recommendation",
    "agents",
    "artifacts",
    "conflictPanel",
    "lastActivity",
    "chatPanel",
  ],
  pm: [
    "phaseBar",
    "cascadeAlert",
    "costPanel",
    "recommendation",
    "lastActivity",
    "antiPatterns",
    "chatPanel",
  ],
  lead: [
    "phaseBar",
    "cascadeAlert",
    "antiPatterns",
    "costPanel",
    "agents",
    "conflictPanel",
    "recommendation",
    "artifacts",
    "lastActivity",
    "chatPanel",
  ],
  admin: [
    "phaseBar",
    "cascadeAlert",
    "antiPatterns",
    "costPanel",
    "agents",
    "conflictPanel",
    "recommendation",
    "artifacts",
    "lastActivity",
    "chatPanel",
  ],
};

/**
 * Get widget layout for a role.
 * Returns ordered list of widget IDs to render.
 */
export function getWidgetLayout(role: UserRole): WidgetId[] {
  return ROLE_LAYOUTS[role] ?? ROLE_LAYOUTS.dev;
}

/** All valid user roles. */
export const USER_ROLES: readonly UserRole[] = ["dev", "pm", "lead", "admin"];
