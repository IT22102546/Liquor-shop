"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../../components/AdminContext";
import { API_URL } from "../../../lib/constants";
import { exportTableToPdf } from "../../../lib/pdf-export";
import { IconActivity, IconInventory, IconInvoice, IconSupplier } from "../../../lib/icons";
import TablePagination, { paginateRows } from "../../../components/TablePagination";

type InventoryPurchase = {
  id: number;
  purchasedAt: string;
  quantity: number;
  finalSellingPrice: number;
  customer: {
    firstName: string;
    lastName: string;
    nic: string;
    mobileNumber: string;
  };
  inventory: {
    displayId: string;
    name: string;
    brand: string;
    category: string;
    supplier?: string | null;
  } | null;
};

export default function SoldInventoryPage() {
  const { token } = useAdmin();
  const [purchases, setPurchases] = useState<InventoryPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const base = `${API_URL}/api/pos/user-management`;
  const auth = { Authorization: `Bearer ${token}` };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const searchParam = search.trim()
        ? `&search=${encodeURIComponent(search.trim())}`
        : "";
      const response = await fetch(
        `${base}/purchases?page=1&limit=500${searchParam}`,
        { headers: auth },
      );
      const payload = (await response.json()) as {
        data?: { purchases?: InventoryPurchase[] };
        message?: string;
      };
      if (!response.ok)
        throw new Error(payload.message ?? "Failed to load sold products");
      setPurchases(
        (payload.data?.purchases ?? []).filter(
          (purchase) => !!purchase.inventory,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load sold products",
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filter purchases by date range
  const filteredPurchases = useMemo(() => {
    let filtered = [...purchases];
    
    if (fromDate) {
      const fromDateTime = new Date(fromDate);
      fromDateTime.setHours(0, 0, 0, 0);
      filtered = filtered.filter(purchase => new Date(purchase.purchasedAt) >= fromDateTime);
    }
    
    if (toDate) {
      const toDateTime = new Date(toDate);
      toDateTime.setHours(23, 59, 59, 999);
      filtered = filtered.filter(purchase => new Date(purchase.purchasedAt) <= toDateTime);
    }
    
    return filtered;
  }, [purchases, fromDate, toDate]);
  const pagedPurchases = useMemo(() => paginateRows(filteredPurchases, page, pageSize), [filteredPurchases, page, pageSize]);
  useEffect(() => { setPage(1); }, [search, fromDate, toDate, pageSize]);

  const totalSoldUnits = useMemo(
    () => filteredPurchases.reduce((sum, purchase) => sum + purchase.quantity, 0),
    [filteredPurchases],
  );
  
  const estimatedRevenue = useMemo(
    () => filteredPurchases.reduce((sum, purchase) => sum + purchase.finalSellingPrice, 0),
    [filteredPurchases],
  );

  const exportSoldInventoryPdf = () => {
    exportTableToPdf({
      fileName: "inventory-sold-report",
      title: "Inventory Sold Report",
      subtitle: "All sold inventory entries currently loaded in Sold Items tab",
      rows: filteredPurchases,
      columns: [
        { header: "Invoice", value: (purchase) => `INV-${String(purchase.id).padStart(5, "0")}` },
        { header: "Purchased At", value: (purchase) => new Date(purchase.purchasedAt).toLocaleString() },
        { header: "Product ID", value: (purchase) => purchase.inventory?.displayId ?? "-" },
        { header: "Product Name", value: (purchase) => purchase.inventory?.name ?? "-" },
        { header: "Category", value: (purchase) => purchase.inventory?.category ?? "-" },
        { header: "Brand", value: (purchase) => purchase.inventory?.brand ?? "-" },
        { header: "Supplier", value: (purchase) => purchase.inventory?.supplier ?? "-" },
        { header: "Customer", value: (purchase) => `${purchase.customer.firstName} ${purchase.customer.lastName}` },
        { header: "Customer NIC", value: (purchase) => purchase.customer.nic },
        { header: "Customer Mobile", value: (purchase) => purchase.customer.mobileNumber },
        { header: "Qty", value: (purchase) => purchase.quantity },
        { header: "Final Price", value: (purchase) => purchase.finalSellingPrice },
      ],
    });
  };

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon">
            <IconInvoice />
          </div>
          <div>
            <h2 className="page-title">Sold Drinks & Products</h2>
            <p className="page-subtitle">
              Review sold drinks and products with a clear sales summary
              separate from current stock.
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        <Link href="/dashboard/inventory" className="btn-outline">
          Drink Inventory
        </Link>
        <Link href="/dashboard/inventory/sold" className="btn-accent">
          Sold Drinks
        </Link>
        <Link href="/dashboard/inventory/manage" className="btn-outline">
          Manage Data
        </Link>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="bm-stats-grid">
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head">
            <span className="bm-stat-icon">
              <IconInventory />
            </span>
            <span className="bm-stat-label">Sold Entries</span>
          </div>
          <strong className="bm-stat-value">{filteredPurchases.length}</strong>
          <span className="bm-stat-sub">Customer-linked purchase records</span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head">
            <span className="bm-stat-icon">
              <IconInvoice />
            </span>
            <span className="bm-stat-label">Sold Units</span>
          </div>
          <strong className="bm-stat-value">{totalSoldUnits}</strong>
          <span className="bm-stat-sub">Total quantity sold</span>
        </div>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head">
            <span className="bm-stat-icon">
              <IconActivity />
            </span>
            <span className="bm-stat-label">Revenue</span>
          </div>
          <strong className="bm-stat-value">
            Rs. {estimatedRevenue.toLocaleString()}
          </strong>
          <span className="bm-stat-sub">From purchase final prices</span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head">
            <span className="bm-stat-icon">
              <IconSupplier />
            </span>
            <span className="bm-stat-label">Source</span>
          </div>
          <strong className="bm-stat-value">Invoices</strong>
          <span className="bm-stat-sub">POS customer purchase records</span>
        </div>
      </div>

      <div className="bm-table-card">
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--panel-border)", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input className="bm-input" style={{ maxWidth: 420 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by customer, NIC, product ID, name or brand" />
          <label htmlFor="sold-inventory-from" style={{ fontSize: 13, color: "var(--text-soft)" }}>From</label>
          <input
            id="sold-inventory-from"
            className="bm-input"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
          <label htmlFor="sold-inventory-to" style={{ fontSize: 13, color: "var(--text-soft)" }}>To</label>
          <input
            id="sold-inventory-to"
            className="bm-input"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
          <button type="button" className="btn-outline" onClick={() => { setFromDate(""); setToDate(""); }}>Clear Dates</button>
          <button type="button" className="btn-outline" onClick={() => void loadData()}>Refresh</button>
          <button type="button" className="btn-outline" onClick={exportSoldInventoryPdf}>Export PDF</button>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Product</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Customer</th>
                <th>Qty</th>
                <th>Final Price</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="bm-table-empty">
                    Loading sold products...
                  </td>
                </tr>
              )}
              {!loading && filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={8} className="bm-table-empty">
                    No sold inventory records yet.
                  </td>
                </tr>
              )}
              {!loading &&
                pagedPurchases.map((purchase) => {
                  return (
                    <tr key={purchase.id} className="bm-vehicle-row">
                      <td>INV-{String(purchase.id).padStart(5, "0")}</td>
                      <td>{new Date(purchase.purchasedAt).toLocaleString()}</td>
                      <td>
                        <span className="bm-vehicle-detail">
                          {purchase.inventory?.name ?? "-"}
                        </span>
                        <span className="bm-vehicle-meta">
                          {purchase.inventory?.displayId ?? "-"}
                        </span>
                      </td>
                      <td>{purchase.inventory?.category ?? "-"}</td>
                      <td>{purchase.inventory?.brand ?? "-"}</td>
                      <td>
                        {purchase.customer.firstName}{" "}
                        {purchase.customer.lastName}
                        <br />
                        <span className="bm-vehicle-meta">
                          {purchase.customer.mobileNumber}
                        </span>
                      </td>
                      <td>{purchase.quantity}</td>
                      <td>Rs. {purchase.finalSellingPrice.toLocaleString()}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={filteredPurchases.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
}
