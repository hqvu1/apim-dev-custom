import React from "react";
import ReactDOM from "react-dom/client";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { CssBaseline, ThemeProvider } from "@komatsu-nagm/component-library";
import { getMsalConfig } from "./auth/msalConfig";
import ToastProvider from "./components/ToastProvider";
import { AuthProvider } from "./auth/AuthProvider";
import { theme } from "./theme";
import "./styles.css";
import "./i18n";
import App from "./App";
import { initiateLogin } from "./utils/loginUtils/initiateLogin";
import { appConfig } from "./config";

(async () => {
  let tenantId: string | null = null;

  if (appConfig.useMockAuth) {
    // In mock mode, use external tenant ID for MSAL initialization (won't actually authenticate)
    tenantId = appConfig.entra.externalTenantId || "mock-tenant";
  } else {
    // In production mode, initiate real login flow
    const initiatedTenantId = initiateLogin();
    if (!initiatedTenantId) {
      const root = ReactDOM.createRoot(document.getElementById("root")!);
      root.render(
        <div style={{ padding: "1rem", fontFamily: "system-ui, Segoe UI, Arial, sans-serif" }}>
          Redirecting to login...
        </div>
      );
      return;
    }
    tenantId = initiatedTenantId;
  }

  // Check for tenant ID in URL or environment, with fallback to already-set value
  const urlTenantId = new URLSearchParams(window.location.search).get("tenant");
  tenantId = urlTenantId || tenantId || import.meta.env.VITE_TENANT_ID || undefined;
  if (!tenantId) {
    console.error("Tenant ID not found. Please check environment variables or URL parameters.");
  }
  const msalConfig = getMsalConfig(tenantId || "");
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