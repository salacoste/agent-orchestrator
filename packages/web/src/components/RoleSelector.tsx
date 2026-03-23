"use client";

import { USER_ROLES, type UserRole } from "@/lib/workflow/widget-registry";

interface RoleSelectorProps {
  role: UserRole;
  onChange: (role: UserRole) => void;
}

/**
 * Role selector dropdown for dashboard header (Story 44.1).
 */
export function RoleSelector({ role, onChange }: RoleSelectorProps) {
  return (
    <select
      value={role}
      onChange={(e) => onChange(e.target.value as UserRole)}
      className="text-[11px] bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] rounded px-2 py-1 outline-none"
      aria-label="Select dashboard role"
      data-testid="role-selector"
    >
      {USER_ROLES.map((r) => (
        <option key={r} value={r}>
          {r.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
