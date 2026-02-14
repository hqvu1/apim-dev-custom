import { useCallback, useEffect, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { AccountInfo } from "@azure/msal-browser";
import { getAccessToken } from "./getAccessToken";

const getLogoutMode = () => {
  const mode = import.meta.env.VITE_LOGOUT_MODE || "msal-plus-bff";
  return mode as "client-only" | "msal-only" | "full" | "msal-plus-bff";
};

const getAemLogoutUrl = () => {
  const direct = import.meta.env.VITE_AEM_LOGOUT_URL || "";
  if (direct) return direct;
  const cdn = (import.meta.env.VITE_CDN_ICON || "").trim();
  return cdn ? `${cdn.replace(/\/+$/, "")}/logout` : "";
};

const ensureTabId = () => {
  try {
    let id = sessionStorage.getItem("mn-tabid");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("mn-tabid", id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
};

const TAB_ID = ensureTabId();

const useLogout = () => {
  const { instance, accounts } = useMsal();
  const isLoggingOutRef = useRef(false);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const mode = getLogoutMode();

  const clearAppLocalStorage = useCallback(() => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (!key.toLowerCase().includes("msal")) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // Best-effort cleanup only.
    }
  }, []);

  const clearAppSessionStorage = useCallback(() => {
    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (!key.toLowerCase().includes("msal")) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {
      // Best-effort cleanup only.
    }
  }, []);

  const clearClientState = useCallback(() => {
    clearAppLocalStorage();
    clearAppSessionStorage();
  }, [clearAppLocalStorage, clearAppSessionStorage]);

  const broadcastLogout = useCallback(() => {
    try {
      if ("BroadcastChannel" in window) {
        if (!bcRef.current) bcRef.current = new BroadcastChannel("mn-auth");
        bcRef.current.postMessage({ type: "mn-logout", sender: TAB_ID });
      }
    } catch {
      // Ignore failures.
    }

    try {
      localStorage.setItem("mn-logout", String(Date.now()));
    } catch {
      // Ignore failures.
    }
  }, []);

  const bffLogout = useCallback(
    async (account: AccountInfo | null) => {
      if (mode !== "msal-plus-bff" && mode !== "full") return;

      const apiBase = import.meta.env.VITE_PORTAL_API_BASE || "/api";
      const scopes = (import.meta.env.VITE_PORTAL_API_SCOPE || "")
        .split(",")
        .map((scope: string) => scope.trim())
        .filter(Boolean);

      const token = await getAccessToken(instance, account, scopes.length ? scopes : undefined);
      if (!token) return;

      const url = `${apiBase}/user/logout`;
      try {
        await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ reason: "user_initiated", ts: Date.now() }),
          keepalive: true
        });
      } catch {
        // Best-effort only.
      }
    },
    [instance, mode]
  );

  const thirdPartySlo = useCallback(() => {
    const logoutUrl = getAemLogoutUrl();
    if (!logoutUrl) return;

    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = logoutUrl;
      document.body.appendChild(iframe);
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          // Ignore cleanup issues.
        }
      }, 2000);
    } catch {
      // Best-effort only.
    }
  }, []);

  const getAuthority = useCallback(
    (tenantId: string | null, account: AccountInfo | null) => {
      try {
        const configured = instance.getConfiguration()?.auth?.authority;
        if (configured) {
          try {
            const { hostname } = new URL(configured);
            const isCiamHost = hostname === "ciamlogin.com" || hostname.endsWith(".ciamlogin.com");
            if (isCiamHost) {
              return configured;
            }
          } catch {
            // Ignore malformed URL.
          }
        }

        const tid = tenantId || (account?.idTokenClaims as { tid?: string } | undefined)?.tid;
        return tid ? `https://login.microsoftonline.com/${tid}` : configured;
      } catch {
        return undefined;
      }
    },
    [instance]
  );

  const msalLogout = useCallback(
    async (account: AccountInfo | null, authority?: string) => {
      try {
        const base = import.meta.env.VITE_BASE_URL || window.location.origin;
        const postLogoutRedirectUri = `${base}/`;

        await instance.logoutRedirect({
          ...(account ? { account } : {}),
          ...(authority ? { authority } : {}),
          postLogoutRedirectUri,
          logoutHint: account?.idTokenClaims?.preferred_username as string | undefined
        });
        return true;
      } catch {
        return false;
      }
    },
    [instance]
  );

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    const email = localStorage.getItem("email");
    const tenantId = localStorage.getItem("tenantId");

    const active = instance.getActiveAccount?.();
    const account =
      active ||
      accounts?.find((acc) => acc.username?.toLowerCase() === email?.toLowerCase()) ||
      accounts?.[0] ||
      null;

    const authority = getAuthority(tenantId, account);

    broadcastLogout();
    clearClientState();
    await bffLogout(account);
    thirdPartySlo();

    if (mode !== "client-only") {
      const ok = await msalLogout(account, authority);
      if (!ok) {
        window.location.replace("/?signedOut=1");
      }
      return;
    }

    window.location.replace("/?signedOut=1");
  }, [accounts, bffLogout, broadcastLogout, clearClientState, getAuthority, msalLogout, mode, instance, thirdPartySlo]);

  useEffect(() => {
    let bc: BroadcastChannel | undefined;

    try {
      if ("BroadcastChannel" in window) {
        bc = new BroadcastChannel("mn-auth");
        bc.onmessage = (event) => {
          if (event?.data?.type !== "mn-logout") return;

          const isFromIdp = event?.data?.source === "idp";
          const isSelf = event?.data?.sender && event.data.sender === TAB_ID;

          if (isSelf) return;
          if (isFromIdp && isLoggingOutRef.current) return;

          clearClientState();
          window.location.replace("/?signedOut=1");
        };
      }
    } catch {
      // Ignore errors.
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === "mn-logout") {
        clearClientState();
        window.location.replace("/?signedOut=1");
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      try {
        bc?.close();
      } catch {
        // Ignore errors.
      }
      window.removeEventListener("storage", onStorage);
    };
  }, [clearClientState]);

  return { logout };
};

export default useLogout;
