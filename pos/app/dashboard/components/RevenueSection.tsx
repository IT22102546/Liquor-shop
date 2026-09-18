"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { readApiData } from "../../lib/api";
import { IconTrend } from "../../lib/icons";

type Purchase = {
  id: number;
  purchasedAt: string;
  itemType: "BIKE" | "INVENTORY";
  quantity: number;
  finalSellingPrice: number;
  purchaseChannel?: "PERSONAL" | "LEASING";
  remainingAmount?: number;
};

export function RevenueSection() {
  const { token } = useAdmin();
  const [revenueMode, setRevenueMode] = useState<"DAILY" | "MONTHLY" | "YEARLY">("MONTHLY");
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const purchasesQuery = useQuery({
    queryKey: ["pos", "revenue-section", "purchases", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/pos/user-management/purchases?page=1&limit=500`, {
        headers: auth,
        cache: "no-store",
      });
      const payload = await readApiData<{ purchases?: Purchase[] }>(response, "Failed to load purchases");
      return payload.purchases ?? [];
    },
  });

  function dateKeyLocal(date: Date, mode: "DAILY" | "MONTHLY" | "YEARLY") {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    if (mode === "YEARLY") return String(year);
    if (mode === "MONTHLY") return `${year}-${month}`;
    return `${year}-${month}-${day}`;
  }

  function labelFromKey(key: string, mode: "DAILY" | "MONTHLY" | "YEARLY") {
    if (mode === "YEARLY") return key;
    if (mode === "MONTHLY") {
      const [y, m] = key.split("-");
      const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString(undefined, { month: "short" });
      return `${month} ${y.slice(-2)}`;
    }
    const [y, m, d] = key.split("-");
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function getSettledRevenue(purchase: Purchase) {
    const remaining = Math.max(0, purchase.remainingAmount ?? 0);
    const settled = purchase.finalSellingPrice - remaining;
    return Math.max(0, Math.min(purchase.finalSellingPrice, settled));
  }

  const purchases = purchasesQuery.data ?? [];
  const loading = purchasesQuery.isPending;
  const error = purchasesQuery.error instanceof Error ? purchasesQuery.error.message : null;

  const groupedRevenue = useMemo(() => {
    const map = new Map<string, { revenue: number; soldUnits: number }>();
    purchases.forEach((purchase) => {
      const key = dateKeyLocal(new Date(purchase.purchasedAt), revenueMode);
      const current = map.get(key) ?? { revenue: 0, soldUnits: 0 };
      current.revenue += getSettledRevenue(purchase);
      current.soldUnits += purchase.quantity;
      map.set(key, current);
    });

    const now = new Date();
    const rangeKeys: string[] = [];

    if (revenueMode === "DAILY") {
      for (let i = 13; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        rangeKeys.push(dateKeyLocal(d, "DAILY"));
      }
    } else if (revenueMode === "MONTHLY") {
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        rangeKeys.push(dateKeyLocal(d, "MONTHLY"));
      }
    } else {
      for (let i = 7; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear() - i, 0, 1);
        rangeKeys.push(dateKeyLocal(d, "YEARLY"));
      }
    }

    return {
      labels: rangeKeys.map((key) => labelFromKey(key, revenueMode)),
      revenueValues: rangeKeys.map((key) => Math.round((map.get(key)?.revenue ?? 0) * 100) / 100),
      soldValues: rangeKeys.map((key) => map.get(key)?.soldUnits ?? 0),
    };
  }, [purchases, revenueMode]);

  if (loading) return <div className="bm-stat-card">Loading revenue data...</div>;
  if (error) return <div className="bm-alert bm-alert-error">{error}</div>;

  return (
    <div className="bm-stats-grid">
      <div className="bm-stat-card">
        <div className="bm-stat-head">
          <span className="bm-stat-icon"><IconTrend /></span>
          <span className="bm-stat-label">Revenue Trend</span>
        </div>
        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {(["DAILY", "MONTHLY", "YEARLY"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={mode === revenueMode ? "btn-accent" : "btn-outline"}
              onClick={() => setRevenueMode(mode)}
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
            >
              {mode}
            </button>
          ))}
        </div>
        <p className="bm-stat-sub" style={{ marginTop: "0.8rem" }}>
          Total revenue across {revenueMode.toLowerCase()} periods
        </p>
      </div>
    </div>
  );
}
