import React from "react";
import ReactDOM from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { getMsalConfig } from "./auth/msalConfig";
import { AuthProvider } from "./auth/AuthProvider";
import ToastProvider from "./components/ToastProvider";
import { theme } from "./theme";
import "./styles.css";
import "./i18n";
import App from "./App";

(async () => {
  // Check for tenant ID from URL or localStorage without forcing redirect
  let tenantId = localStorage.getItem("tenantId");
  
  const url = new URL(window.location.href);
  const queryParams = url.searchParams;
  const hashParams = new URLSearchParams(url.hash?.replace(/^#/, ""));
  
  const incomingTenant = queryParams.get("tenantId") ?? hashParams.get("tenantId");
  const incomingEmail = queryParams.get("email") ?? hashParams.get("email");
  
  if (!tenantId && (incomingTenant || incomingEmail)) {
    if (incomingTenant) {
      localStorage.setItem("tenantId", incomingTenant);
      tenantId = incomingTenant;
    }
    if (incomingEmail) {
      localStorage.setItem("email", incomingEmail);
    }
    window.history.replaceState({}, "", url.origin + url.pathname);
  }

  // Use default tenant ID if none is found (allows public access)
  const effectiveTenantId = tenantId || "common";

  const msalConfig = getMsalConfig(effectiveTenantId);
  const pca = new PublicClientApplication(msalConfig);
  await pca.initialize();

  try {
    const result = await pca.handleRedirectPromise();
    if (result?.account) {
      pca.setActiveAccount(result.account);
    }
  } catch {
    // Ignore redirect errors; login hook will handle re-auth.
  }

  sessionStorage.removeItem("mn_login_attempted");

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <MsalProvider instance={pca}>
        <AuthProvider>
          <ToastProvider>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <App />
            </ThemeProvider>
          </ToastProvider>
        </AuthProvider>
      </MsalProvider>
    </React.StrictMode>
  );
})();
