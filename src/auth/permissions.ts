/**
 * RBAC permission types and helpers.
 *
 * Mirrors the BFF's rbac-policies.json permission model so the SPA can
 * conditionally render UI elements based on the user's effective permissions.
 *
 * IMPORTANT: Frontend RBAC is for **UX** (hide/show). The BFF is the
 * **security boundary** — it validates tokens and enforces permissions on
 * every request.
 *
 * @see docs/BFF_MIGRATION_DECISION.md §2 — Permission Model
 * @see docs/ARCHITECTURE_DESIGN.md §3 — Authentication & Authorization
 */

// ---------------------------------------------------------------------------
// Permission enum — matches the BFF's Permissions.cs / rbac-policies.json
// ---------------------------------------------------------------------------

export enum Permission {
  Read = "read",
  TryIt = "tryit",
  Subscribe = "subscribe",
  Manage = "manage",
}

// ---------------------------------------------------------------------------
// Role definitions — matches Entra ID roles / Global Admin framework
// ---------------------------------------------------------------------------

export type AppRole =
  | "Admin"
  | "GlobalAdmin"
  | "Developer"
  | "Tester"
  | "Viewer";

// ---------------------------------------------------------------------------
// Client-side RBAC policy (mirrors rbac-policies.json for UX gating)
// ---------------------------------------------------------------------------

type RbacPolicy = {
  role: AppRole;
  apis: string[]; // ["*"] means all APIs
  permissions: Permission[];
};

/**
 * Default RBAC policy map. In a future phase this can be fetched from
 * `GET /api/admin/rbac/policies` so admins can update without a redeploy.
 */
const DEFAULT_POLICIES: RbacPolicy[] = [
  {
    role: "Admin",
    apis: ["*"],
    permissions: [Permission.Read, Permission.TryIt, Permission.Subscribe, Permission.Manage],
  },
  {
    role: "GlobalAdmin",
    apis: ["*"],
    permissions: [Permission.Read, Permission.TryIt, Permission.Subscribe, Permission.Manage],
  },
  {
    role: "Developer",
    apis: ["warranty-api", "punchout-api", "equipment-api"],
    permissions: [Permission.Read, Permission.TryIt, Permission.Subscribe],
  },
  {
    role: "Tester",
    apis: ["warranty-api", "punchout-api", "equipment-api"],
    permissions: [Permission.Read, Permission.TryIt],
  },
  {
    role: "Viewer",
    apis: ["*"],
    permissions: [Permission.Read],
  },
];

// ---------------------------------------------------------------------------
// Permission check helpers
// ---------------------------------------------------------------------------

/**
 * Check whether any of the user's roles grant a given permission,
 * optionally scoped to a specific API.
 */
export function hasPermission(
  userRoles: string[],
  permission: Permission,
  apiId?: string,
  policies: RbacPolicy[] = DEFAULT_POLICIES
): boolean {
  return policies.some((policy) => {
    const roleMatch = userRoles.includes(policy.role);
    if (!roleMatch) return false;

    const permMatch = policy.permissions.includes(permission);
    if (!permMatch) return false;

    if (apiId) {
      return policy.apis.includes("*") || policy.apis.includes(apiId);
    }
    return true;
  });
}

/** Convenience: is user an Admin or GlobalAdmin? */
export function isAdmin(userRoles: string[]): boolean {
  return userRoles.includes("Admin") || userRoles.includes("GlobalAdmin");
}

/** Returns the list of permissions a user has for a given API (or globally). */
export function getEffectivePermissions(
  userRoles: string[],
  apiId?: string,
  policies: RbacPolicy[] = DEFAULT_POLICIES
): Permission[] {
  const all = new Set<Permission>();
  for (const policy of policies) {
    if (!userRoles.includes(policy.role)) continue;
    if (apiId && !policy.apis.includes("*") && !policy.apis.includes(apiId)) continue;
    policy.permissions.forEach((p) => all.add(p));
  }
  return Array.from(all);
}
