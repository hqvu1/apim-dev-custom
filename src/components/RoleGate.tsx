import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { ROUTES } from "../config";

/**
 * Route guard that redirects to /access-denied when the user lacks
 * the required Entra ID roles.
 *
 * NOTE: This is a **UX gate** — the BFF enforces real security.
 * @see docs/BFF_MIGRATION_DECISION.md §2 — RBAC layer
 */
const RoleGate = ({ roles, children }: { roles: string[]; children: React.ReactNode }) => {
  const { roles: userRoles } = useAuth();

  const allowed = roles.some((role) => userRoles.includes(role));

  if (!allowed) {
    return <Navigate to={ROUTES.ACCESS_DENIED} replace />;
  }

  return <>{children}</>;
};

export default RoleGate;
