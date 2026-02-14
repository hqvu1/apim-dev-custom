import { useEffect } from "react";
import { useMsal } from "@azure/msal-react";

const SsoLogoutHandler = () => {
  const { instance } = useMsal();

  useEffect(() => {
    const isInIframe = window.self !== window.top;

    const handleLogout = async () => {
      try {
        instance.setActiveAccount(null);
      } catch {
        // Best-effort only.
      }

      try {
        if ("BroadcastChannel" in window) {
          const bc = new BroadcastChannel("mn-auth");
          bc.postMessage({ type: "mn-logout", source: "idp", ts: Date.now() });
          bc.close();
        }
      } catch {
        // Ignore failures.
      }

      try {
        localStorage.setItem("mn-logout", String(Date.now()));
      } catch {
        // Ignore failures.
      }

      try {
        Object.keys(localStorage).forEach((key) => {
          if (!key.toLowerCase().includes("msal")) {
            localStorage.removeItem(key);
          }
        });

        Object.keys(sessionStorage).forEach((key) => {
          if (!key.toLowerCase().includes("msal")) {
            sessionStorage.removeItem(key);
          }
        });
      } catch {
        // Ignore failures.
      }

      if (!isInIframe) {
        try {
          window.location.replace("/?signedOut=1");
        } catch {
          // Ignore failures.
        }
      }
    };

    handleLogout();
  }, [instance]);

  return <div style={{ display: "none" }}>SSO logout handled</div>;
};

export default SsoLogoutHandler;
