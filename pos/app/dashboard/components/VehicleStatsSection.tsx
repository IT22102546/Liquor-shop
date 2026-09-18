"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { readApiData } from "../../lib/api";
import { IconBike } from "../../lib/icons";

type VehicleSummary = {
  id: number;
  status: "available" | "sold";
  taxAmount?: number;
  expenses?: Array<{ amount: number }>;
};

type Purchase = {
  id: number;
  itemType: "BIKE" | "INVENTORY";
  purchaseChannel?: "PERSONAL" | "LEASING";
};

export function VehicleStatsSection() {
  const { token } = useAdmin();
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const vehiclesQuery = useQuery({
    queryKey: ["pos", "vehicle-section", "vehicles", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/pos/bike-management/vehicles?limit=5000`, {
        headers: auth,
        cache: "no-store",
      });
      const payload = await readApiData<{ vehicles?: VehicleSummary[] }>(response, "Failed to load bike summary");
      return payload.vehicles ?? [];
    },
  });

  const purchasesQuery = useQuery({
    queryKey: ["pos", "vehicle-section", "purchases", token],
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

  const vehicles = vehiclesQuery.data ?? [];
  const purchases = purchasesQuery.data ?? [];
  const loading = vehiclesQuery.isPending || purchasesQuery.isPending;
  const error = vehiclesQuery.error instanceof Error ? vehiclesQuery.error.message : purchasesQuery.error instanceof Error ? purchasesQuery.error.message : null;

  const stats = useMemo(() => {
    const totalBikes = purchases.filter((p) => p.itemType === "BIKE").length;
    const personalBikes = purchases.filter((p) => p.itemType === "BIKE" && p.purchaseChannel !== "LEASING").length;
    const leasingBikes = purchases.filter((p) => p.itemType === "BIKE" && p.purchaseChannel === "LEASING").length;

    return { totalBikes, personalBikes, leasingBikes };
  }, [purchases]);

  if (loading) return <div className="bm-stat-card">Loading bike stats...</div>;
  if (error) return <div className="bm-alert bm-alert-error">{error}</div>;

  return (
    <div className="bm-stats-grid">
      <div className="bm-stat-card">
        <div className="bm-stat-head">
          <span className="bm-stat-icon"><IconBike /></span>
          <span className="bm-stat-label">Total Drinks Sold</span>
        </div>
        <strong className="bm-stat-value">{stats.totalBikes}</strong>
        <span className="bm-stat-sub">Personal: {stats.personalBikes} | Leasing: {stats.leasingBikes}</span>
      </div>
    </div>
  );
}
