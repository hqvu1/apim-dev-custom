import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const RoleGate = ({ roles, children }: { roles: string[]; children: React.ReactNode }) => {
  const { roles: userRoles } = useAuth();

  const allowed = roles.some((role) => userRoles.includes(role));

  if (!allowed) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
};

export default RoleGate;
