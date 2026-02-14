import { useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { BrowserUtils } from "@azure/msal-browser";

const parseScopes = () => {
  const raw = import.meta.env.VITE_LOGIN_SCOPES || "";
  const scopes = raw
    .split(",")
    .map((scope: string) => scope.trim())
    .filter(Boolean);
  return scopes.length ? scopes : ["User.Read"];
};

const useMsalLogin = () => {
  const { instance, accounts } = useMsal();

  useEffect(() => {
    const qp = new URL(window.location.href).searchParams;
    const isLogoutFlow =
      qp.get("action") === "userlogout" ||
      qp.get("action") === "frontchannellogout" ||
      qp.get("signedOut") === "1";

    if (isLogoutFlow) return;

    if (instance.getActiveAccount() || accounts.length > 0) return;

    const marker = "mn_login_attempted";
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, "1");

    if (BrowserUtils.isInIframe()) {
      sessionStorage.removeItem(marker);
      return;
    }

    const email = localStorage.getItem("email") ?? undefined;
    instance
      .loginRedirect({
        scopes: parseScopes(),
        loginHint: email,
        redirectUri: window.location.origin
      })
      .catch(() => {
        sessionStorage.removeItem(marker);
      });
  }, [instance, accounts.length]);
};

export default useMsalLogin;
