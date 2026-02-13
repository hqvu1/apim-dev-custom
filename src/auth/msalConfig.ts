import { Configuration, PublicClientApplication } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID || "";
const authority = import.meta.env.VITE_ENTRA_AUTHORITY || "";
const redirectUri = import.meta.env.VITE_ENTRA_REDIRECT_URI || window.location.origin;

const config: Configuration = {
  auth: {
    clientId,
    authority,
    redirectUri
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false
  }
};

export const msalInstance = new PublicClientApplication(config);

export const loginRequest = {
  scopes: [import.meta.env.VITE_PORTAL_API_SCOPE || "User.Read"]
};
