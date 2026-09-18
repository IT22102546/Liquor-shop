"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Theme } from "../lib/types";
import { STORAGE_THEME } from "../lib/constants";

type ThemeCtxType = { theme: Theme; toggleTheme: () => void };
const ThemeCtx = createContext<ThemeCtxType>({ theme: "light", toggleTheme: () => {} });
const CHUNK_RELOAD_KEY = "pos_chunk_reload_attempted";

function isChunkLoadFailure(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|chunk \d+ failed/i.test(message);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_THEME) as Theme | null;
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_THEME, theme);
  }, [theme]);

  useEffect(() => {
    const reloadOnce = () => {
      try {
        if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") {
          return false;
        }
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      } catch {
        // If storage is unavailable, still try to recover.
      }
      window.location.reload();
      return true;
    };

    const onWindowError = (event: ErrorEvent) => {
      if (isChunkLoadFailure(event.error) || isChunkLoadFailure(event.message)) {
        reloadOnce();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadFailure(event.reason)) {
        reloadOnce();
      }
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")) }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
