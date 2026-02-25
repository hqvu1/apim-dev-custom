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
import { initiateLogin } from "./utils/loginUtils/initiateLogin";

const useMockAuth = import.meta.env.VITE_USE_MOCK_AUTH === "true";

(async () => {
  let tenantId: string | null;

  if (useMockAuth) {
    // In mock mode, use external tenant ID for MSAL initialization (won't actually authenticate)
    tenantId = import.meta.env.VITE_EXTERNAL_TENANT_ID || "mock-tenant";
  } else {
    // In production mode, initiate real login flow
    tenantId = initiateLogin();
    if (!tenantId) {
      const root = ReactDOM.createRoot(document.getElementById("root")!);
      root.render(
        <div style={{ padding: "1rem", fontFamily: "system-ui, Segoe UI, Arial, sans-serif" }}>
          Redirecting to login...
        </div>
      );
      return;
    }
  }

  const msalConfig = getMsalConfig(tenantId);
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
