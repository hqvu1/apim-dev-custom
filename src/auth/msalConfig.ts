import { Configuration, LogLevel } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID || "";
const externalTenantId = import.meta.env.VITE_EXTERNAL_TENANT_ID || "";
const workforceTenantId = import.meta.env.VITE_WORKFORCE_TENANT_ID || "";
const ciamHost = import.meta.env.VITE_CIAM_HOST || "kltdexternaliddev.ciamlogin.com";

const TENANT_DETAILS: Record<string, Configuration["auth"]> = {
  ...(externalTenantId
    ? {
        [externalTenantId]: {
          clientId,
          authority: `https://${ciamHost}/${externalTenantId}`,
          redirectUri: window.location.origin,
          postLogoutRedirectUri: `${window.location.origin}/`
        }
      }
    : {}),
  ...(workforceTenantId
    ? {
        [workforceTenantId]: {
          clientId,
          authority: `https://login.microsoftonline.com/${workforceTenantId}`,
          redirectUri: window.location.origin,
          postLogoutRedirectUri: `${window.location.origin}/`
        }
      }
    : {})
};

export const getMsalConfig = (tenantId: string): Configuration => {
  const baseAuth = TENANT_DETAILS[tenantId];
  const fallbackAuthority = workforceTenantId
    ? `https://login.microsoftonline.com/${workforceTenantId}`
    : "https://login.microsoftonline.com/common";

  const auth =
    baseAuth ||
    ({
      clientId,
      authority: fallbackAuthority,
      redirectUri: window.location.origin,
      postLogoutRedirectUri: `${window.location.origin}/`
    } satisfies Configuration["auth"]);

  return {
    auth,
    cache: {
      cacheLocation: "localStorage",
      storeAuthStateInCookie: false
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          switch (level) {
            case LogLevel.Error:
              console.error(message);
              return;
            case LogLevel.Warning:
              console.warn(message);
              return;
            case LogLevel.Info:
              console.info(message);
              return;
            case LogLevel.Verbose:
              console.debug(message);
              return;
            default:
              return;
          }
        }
      },
      allowRedirectInIframe: true,
      iframeHashTimeout: 6000
    }
  };
};

export const loginRequest = {
  scopes: [import.meta.env.VITE_PORTAL_API_SCOPE || "User.Read"]
};
