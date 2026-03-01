/**
 * usePermissions — React hook for client-side RBAC checks.
 *
 * Reads the current user's Entra ID roles from AuthContext and evaluates
 * them against the permission model defined in `permissions.ts`.
 *
 * Usage:
 *   const { canRead, canTryIt, canSubscribe, canManage, isAdmin } = usePermissions("warranty-api");
 *
 * @see docs/BFF_MIGRATION_DECISION.md §2 — Permission Model
 */
import { useMemo } from "react";
import { useAuth } from "./useAuth";
import {
  Permission,
  getEffectivePermissions,
  hasPermission,
  isAdmin as checkIsAdmin,
} from "./permissions";

export type PermissionCheckResult = {
  /** User can view API details / catalog listing. */
  canRead: boolean;
  /** User can open the Try-It console. */
  canTryIt: boolean;
  /** User can request / create subscriptions. */
  canSubscribe: boolean;
  /** User can manage RBAC, APIs, and admin settings. */
  canManage: boolean;
  /** User has Admin or GlobalAdmin role. */
  isAdmin: boolean;
  /** All effective permissions for this context. */
  permissions: Permission[];
  /** Generic check against any permission + optional apiId. */
  has: (permission: Permission, apiId?: string) => boolean;
};

/**
 * @param apiId — Optional API ID to scope the permission check.
 *                Omit for global checks (e.g., "can the user see /admin?").
 */
export function usePermissions(apiId?: string): PermissionCheckResult {
  const { roles } = useAuth();

  return useMemo(() => {
    const permissions = getEffectivePermissions(roles, apiId);

    return {
      canRead: hasPermission(roles, Permission.Read, apiId),
      canTryIt: hasPermission(roles, Permission.TryIt, apiId),
      canSubscribe: hasPermission(roles, Permission.Subscribe, apiId),
      canManage: hasPermission(roles, Permission.Manage, apiId),
      isAdmin: checkIsAdmin(roles),
      permissions,
      has: (permission: Permission, overrideApiId?: string) =>
        hasPermission(roles, permission, overrideApiId ?? apiId),
    };
  }, [roles, apiId]);
}
