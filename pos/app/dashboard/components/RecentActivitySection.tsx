"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { readApiData } from "../../lib/api";
import { IconActivity } from "../../lib/icons";

type Purchase = {
  id: number;
  purchasedAt: string;
  itemType: "BIKE" | "INVENTORY";
  quantity: number;
  finalSellingPrice: number;
  customer: {
    id: number;
    firstName: string;
    lastName: string;
  };
  bike?: {
    brand?: string;
    model?: string;
  } | null;
  inventory?: {
    name?: string;
  } | null;
};

export function RecentActivitySection() {
  const { token } = useAdmin();
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const purchasesQuery = useQuery({
    queryKey: ["pos", "activity-section", "purchases", token],
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

  const purchases = purchasesQuery.data ?? [];
  const loading = purchasesQuery.isPending;
  const error = purchasesQuery.error instanceof Error ? purchasesQuery.error.message : null;

  const recentActivity = useMemo(() => {
    return [...purchases]
      .sort((a, b) => +new Date(b.purchasedAt) - +new Date(a.purchasedAt))
      .slice(0, 6);
  }, [purchases]);

  if (loading) return <div className="bm-stat-card">Loading activity...</div>;
  if (error) return <div className="bm-alert bm-alert-error">{error}</div>;

  return (
    <div className="bm-table-card">
      <div style={{ padding: "1rem", borderBottom: "1px solid var(--panel-border)" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <IconActivity /> Recent Activity
        </h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--panel-border)" }}>
              <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.85rem", fontWeight: 600 }}>Customer</th>
              <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.85rem", fontWeight: 600 }}>Item</th>
              <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.85rem", fontWeight: 600 }}>Type</th>
              <th style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.85rem", fontWeight: 600 }}>Amount</th>
              <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.85rem", fontWeight: 600 }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.map((purchase, idx) => (
              <tr key={`activity-${purchase.id}-${idx}`} style={{ borderBottom: "1px solid var(--panel-border)" }}>
                <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>
                  {purchase.customer.firstName} {purchase.customer.lastName}
                </td>
                <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>
                  {purchase.itemType === "BIKE" && purchase.bike
                    ? `${purchase.bike.brand ?? "-"} ${purchase.bike.model ?? "-"}`
                    : purchase.inventory?.name ?? "-"}
                </td>
                <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>
                  {purchase.itemType === "BIKE" ? "Bike" : "Spare Part"}
                </td>
                <td style={{ padding: "0.75rem", fontSize: "0.9rem", textAlign: "right", fontWeight: 600 }}>
                  Rs. {purchase.finalSellingPrice.toLocaleString()}
                </td>
                <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>
                  {new Date(purchase.purchasedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
