import { Configuration, LogLevel } from "@azure/msal-browser";
import { appConfig } from "../config";

const clientId = appConfig.entra.clientId;
const externalTenantId = appConfig.entra.externalTenantId;
const workforceTenantId = appConfig.entra.workforceTenantId;
const ciamHost = appConfig.entra.ciamHost;

const TENANT_DETAILS: Record<string, Configuration["auth"]> = {
  ...(externalTenantId
    ? {
        [externalTenantId]: {
          clientId,
          authority: `https://${ciamHost}/${externalTenantId}`,
          redirectUri: globalThis.location.origin,
          postLogoutRedirectUri: `${globalThis.location.origin}/`
        }
      }
    : {}),
  ...(workforceTenantId
    ? {
        [workforceTenantId]: {
          clientId,
          authority: `https://login.microsoftonline.com/${workforceTenantId}`,
          redirectUri: globalThis.location.origin,
          postLogoutRedirectUri: `${globalThis.location.origin}/`
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
      redirectUri: globalThis.location.origin,
      postLogoutRedirectUri: `${globalThis.location.origin}/`
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
  scopes: [appConfig.entra.portalApiScope]
};
