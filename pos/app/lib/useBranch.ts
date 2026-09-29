"use client";

import { useQuery } from "@tanstack/react-query";
import { API_URL } from "./constants";
import { readApiData } from "./api";

export type Branch = { id: number; code: string; name: string; address: string | null; phone: string | null; email?: string | null; isMain: boolean };
export type BranchState = { branch: Branch & { fixed: boolean }; canSwitch: boolean; branches: Array<{ id: number; code: string; name: string }> };

/** The branch the signed-in person is working in (stock, tills and Day End all follow it). */
export function useBranch(token: string) {
  const query = useQuery({
    queryKey: ["pos", "branch", token],
    enabled: Boolean(token),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/pos/branches/current`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      return readApiData<BranchState>(response, "Could not load your branch");
    },
  });
  return { state: query.data ?? null, branch: query.data?.branch ?? null, loaded: query.isSuccess };
}

/** Moves to another branch; the page reloads so every figure is that branch's. */
export async function switchBranch(token: string, branchId: number) {
  const response = await fetch(`${API_URL}/api/pos/branches/switch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ branchId }),
  });
  await readApiData<BranchState>(response, "Could not switch branch");
  window.location.reload();
}
