import { InteractionStatus } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LoadingScreen from "./LoadingScreen";
import useMsalLogin from "../utils/loginUtils/customHooks/useMsalLogin";
import { appConfig } from "../config";

const PrivateRoute = () => {
  const { instance, inProgress, accounts } = useMsal();
  const { t } = useTranslation();
  useMsalLogin();

  if (appConfig.useMockAuth) {
    return <Outlet />;
  }

  if (inProgress !== InteractionStatus.None) {
    return <LoadingScreen message={t("auth.signingIn")} />;
  }

  if (accounts.length === 0 || !instance.getActiveAccount()) {
    return <LoadingScreen message={t("auth.redirecting")} />;
  }

  return <Outlet />;
};

export default PrivateRoute;
