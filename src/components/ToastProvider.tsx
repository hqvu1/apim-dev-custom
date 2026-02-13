import React, { createContext, useCallback, useMemo, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

export type ToastContextValue = {
  notify: (message: string, severity?: "success" | "info" | "warning" | "error") => void;
};

export const ToastContext = createContext<ToastContextValue>({
  notify: () => undefined
});

const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"success" | "info" | "warning" | "error">("info");

  const notify = useCallback(
    (nextMessage: string, nextSeverity: "success" | "info" | "warning" | "error" = "info") => {
      setMessage(nextMessage);
      setSeverity(nextSeverity);
      setOpen(true);
    },
    []
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={severity} variant="filled" onClose={() => setOpen(false)}>
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
