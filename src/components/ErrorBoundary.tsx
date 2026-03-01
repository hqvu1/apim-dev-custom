import React from "react";
import { Box, Button, Typography } from "@mui/material";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  /** Optional fallback UI. When omitted the default "Something went wrong" screen is shown. */
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

/**
 * Global error boundary with structured logging.
 *
 * Catches uncaught rendering errors anywhere in the component tree and:
 *  1. Renders a user-friendly fallback UI.
 *  2. Logs the error + component stack to the console in a structured format
 *     that Application Insights can ingest.
 *
 * @see docs/ARCHITECTURE_DESIGN.md §8 — Security Architecture (structured logging)
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
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

  private readonly handleRefresh = () => {
    this.setState({ hasError: false, error: undefined });
    globalThis.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={6}>
          <Typography variant="h5">Something went wrong.</Typography>
          <Typography color="text.secondary">
            Please refresh the page or contact support if the issue persists.
          </Typography>
          {/* Show error name in non-production environments for debugging */}
          {import.meta.env.DEV && this.state.error && (
            <Typography
              variant="caption"
              color="error"
              sx={{ fontFamily: "monospace", maxWidth: 600, wordBreak: "break-word" }}
            >
              {this.state.error.message}
            </Typography>
          )}
          <Button variant="contained" onClick={this.handleRefresh}>
            Refresh
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
