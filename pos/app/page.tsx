"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { STORAGE_ADMIN, STORAGE_TOKEN } from "./lib/constants";
import type { PosAdmin } from "./lib/types";
import { ROLE_HOME } from "./lib/roles";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN);
    const savedAdmin = localStorage.getItem(STORAGE_ADMIN);
    if (!token || !savedAdmin) {
      router.replace("/signin");
      return;
    }
    try {
      const admin = JSON.parse(savedAdmin) as PosAdmin;
      router.replace(ROLE_HOME[admin.role] ?? "/dashboard/inventory");
    } catch {
      router.replace("/signin");
    }
  }, [router]);

  return <main className="pos-shell" />;
}
