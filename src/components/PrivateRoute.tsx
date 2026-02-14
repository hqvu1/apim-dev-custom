import { InteractionStatus } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { Outlet } from "react-router-dom";
import LoadingScreen from "./LoadingScreen";
import useMsalLogin from "../utils/loginUtils/customHooks/useMsalLogin";

const useMockAuth = import.meta.env.VITE_USE_MOCK_AUTH === "true";

const PrivateRoute = () => {
  const { instance, inProgress, accounts } = useMsal();
  useMsalLogin();

  if (useMockAuth) {
    return <Outlet />;
  }

  if (inProgress !== InteractionStatus.None) {
    return <LoadingScreen message="Signing you in..." />;
  }

  if (accounts.length === 0 || !instance.getActiveAccount()) {
    return <LoadingScreen message="Redirecting to Entra ID..." />;
  }

  return <Outlet />;
};

export default PrivateRoute;
