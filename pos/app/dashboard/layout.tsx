"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { AdminCtx } from "../components/AdminContext";
import { QueryProvider } from "../components/QueryProvider";
import { API_URL, STORAGE_TOKEN, STORAGE_ADMIN } from "../lib/constants";
import type { PosAdmin } from "../lib/types";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<PosAdmin | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_TOKEN);
    const savedAdmin = localStorage.getItem(STORAGE_ADMIN);
    if (!savedToken || !savedAdmin) {
      router.replace("/signin");
      return;
    }

    const clearSession = () => {
      localStorage.removeItem(STORAGE_TOKEN);
      localStorage.removeItem(STORAGE_ADMIN);
      router.replace("/signin");
    };

    try {
      setToken(savedToken);
      setAdmin(JSON.parse(savedAdmin) as PosAdmin);
    } catch {
      clearSession();
      return;
    }
    setChecked(true);

    const verifySession = async () => {
      try {
        const res = await fetch(`${API_URL}/api/pos/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (!res.ok) {
          clearSession();
          return;
        }
        const payload = (await res.json()) as { data: PosAdmin };
        setAdmin(payload.data);
        localStorage.setItem(STORAGE_ADMIN, JSON.stringify(payload.data));
      } catch {
        // network error — keep session until next verification
      }
    };

    void verifySession();
    const intervalId = window.setInterval(() => { void verifySession(); }, 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_ADMIN);
    router.replace("/signin");
  };

  if (!checked || !admin || !token) {
    return <main className="pos-shell" />;
  }

  return (
    <QueryProvider>
      <AdminCtx.Provider value={{ admin, token, logout }}>
        <main className="pos-shell">
          <Sidebar />
          <div className="main-area">
            <Topbar />
            <div className="page-content">{children}</div>
          </div>
        </main>
      </AdminCtx.Provider>
    </QueryProvider>
  );
}
