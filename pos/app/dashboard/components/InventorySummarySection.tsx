"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { readApiData } from "../../lib/api";
import { IconInventory } from "../../lib/icons";

type InventoryProduct = {
  id: number;
  quantity: number;
  lowStockThreshold?: number | null;
};

export function InventorySummarySection() {
  const { token } = useAdmin();
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const productsQuery = useQuery({
    queryKey: ["pos", "inventory-section", "products", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/pos/bike-management/products?page=1&limit=500`, {
        headers: auth,
        cache: "no-store",
      });
      const payload = await readApiData<{ products?: InventoryProduct[] }>(response, "Failed to load inventory summary");
      return payload.products ?? [];
    },
  });

  const products = productsQuery.data ?? [];
  const loading = productsQuery.isPending;
  const error = productsQuery.error instanceof Error ? productsQuery.error.message : null;

  const stats = useMemo(() => {
    const lowStockAlerts = products.filter((product) => {
      const threshold = product.lowStockThreshold ?? 0;
      return threshold > 0 && product.quantity <= threshold;
    }).length;

    const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0);

    return { totalUnits, lowStockAlerts, totalProducts: products.length };
  }, [products]);

  if (loading) return <div className="bm-stat-card">Loading inventory...</div>;
  if (error) return <div className="bm-alert bm-alert-error">{error}</div>;

  return (
    <div className="bm-stats-grid">
      <div className="bm-stat-card">
        <div className="bm-stat-head">
          <span className="bm-stat-icon"><IconInventory /></span>
          <span className="bm-stat-label">Total Units</span>
        </div>
        <strong className="bm-stat-value">{stats.totalUnits}</strong>
        <span className="bm-stat-sub">Drinks and products in stock across {stats.totalProducts} items</span>
      </div>

      {stats.lowStockAlerts > 0 && (
        <div className="bm-stat-card" style={{ borderLeft: "3px solid #dc2626" }}>
          <div className="bm-stat-head">
            <span className="bm-stat-label">Low Stock Alerts</span>
          </div>
          <strong className="bm-stat-value" style={{ color: "#dc2626" }}>{stats.lowStockAlerts}</strong>
          <span className="bm-stat-sub">Products below threshold</span>
        </div>
      )}
    </div>
  );
}
