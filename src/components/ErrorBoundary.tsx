import React from "react";
import { Box, Button, Typography } from "@mui/material";

type ErrorBoundaryState = { hasError: boolean };

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={6}>
          <Typography variant="h5">Something went wrong.</Typography>
          <Typography color="text.secondary">
            Please refresh the page or contact support if the issue persists.
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
