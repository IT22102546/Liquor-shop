"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { STORAGE_TOKEN } from "./lib/constants";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN);
    router.replace(token ? "/dashboard" : "/signin");
  }, [router]);

  return <main className="pos-shell" />;
}
