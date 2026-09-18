"use client";

import { createContext, useContext } from "react";
import type { PosAdmin } from "../lib/types";

type AdminCtxType = {
  admin: PosAdmin;
  token: string;
  logout: () => void;
};

export const AdminCtx = createContext<AdminCtxType | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("useAdmin must be used inside dashboard layout");
  return ctx;
}
