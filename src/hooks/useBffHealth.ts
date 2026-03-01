/**
 * useBffHealth — Periodically checks the BFF health endpoint.
 *
 * Components can use this to show degraded-mode banners when the BFF
 * is unavailable (e.g., "Using local catalog data until the portal API is ready.").
 *
 * @see docs/ARCHITECTURE_DESIGN.md §4 — GET /health → liveness check
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { appConfig } from "../config";

export type BffHealthStatus = "healthy" | "unhealthy" | "checking";

export function useBffHealth(intervalMs = 60_000) {
  const [status, setStatus] = useState<BffHealthStatus>("checking");
  const abortRef = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${appConfig.apiBase}/health`, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setStatus(res.ok ? "healthy" : "unhealthy");
      }
    } catch {
      if (!controller.signal.aborted) {
        setStatus("unhealthy");
      }
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, intervalMs);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [check, intervalMs]);

  return status;
}
