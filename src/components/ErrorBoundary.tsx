import React from "react";
import { Box, Button, Typography } from "@mui/material";
import i18n from "../i18n";

type ErrorBoundaryState = { hasError: boolean; error?: Error };

class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Structured log for Application Insights / browser console
    console.error("[ErrorBoundary] Uncaught error in component tree", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={6}>
          <Typography variant="h5">{i18n.t("error.title")}</Typography>
          <Typography color="text.secondary">
            {i18n.t("error.description")}
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            {i18n.t("error.refresh")}
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
