import React from "react";
import ReactDOM from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { msalInstance } from "./auth/msalConfig";
import { AuthProvider } from "./auth/AuthProvider";
import ToastProvider from "./components/ToastProvider";
import { theme } from "./theme";
import "./styles.css";
import "./i18n";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
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
