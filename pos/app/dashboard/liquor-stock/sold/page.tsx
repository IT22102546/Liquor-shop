"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../../components/AdminContext";
import { API_URL } from "../../../lib/constants";
import { IconActivity, IconBike, IconInventory, IconInvoice } from "../../../lib/icons";
import TablePagination, { paginateRows } from "../../../components/TablePagination";

type VehicleImage = { id: number; vehicleId: number; url: string; isPrimary: boolean; sortOrder: number; createdAt: string };
type Expense = { id: number; description: string; amount: number; createdAt: string };
type Vehicle = {
  id: number;
  displayId: string;
  brand: { id?: number; name: string };
  model: { id?: number; name: string };
  supplier?: { id: number; name: string; code: string } | null;
  colour: string;
  year?: number;
  manufactureDate?: string;
  createdAt: string;
  fileNo?: string;
  registerNo?: string;
  chassisNo?: string;
  engineNo?: string;
  engineCapacityCc?: number;
  condition?: "brandnew" | "used";
  mileage?: number;
  description?: string;
  registrationType?: "registered" | "unregistered";
  purchasePrice?: number;
  taxAmount?: number;
  sellingPrice?: number;
  soldAt?: string;
  expenses?: Expense[];
  images?: VehicleImage[];
};

type BikePurchase = {
  id: number;
  purchasedAt: string;
  finalSellingPrice: number;
  customer: {
    firstName: string;
    lastName: string;
    nic: string;
    mobileNumber: string;
    province: string;
    district: string;
    address: string;
  };
  bike: {
    id: number;
  } | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ImageGallery({ images }: { images: VehicleImage[] }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const sorted = [...images].sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : a.sortOrder - b.sortOrder));

  const openLightbox = (idx: number) => {
    setSelectedIdx(idx);
    setLightboxOpen(true);
  };

  const goPrev = () => setSelectedIdx((idx) => (idx - 1 + sorted.length) % sorted.length);
  const goNext = () => setSelectedIdx((idx) => (idx + 1) % sorted.length);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, sorted.length]);

  if (sorted.length === 0) {
    return (
      <div className="bm-gallery-empty">
        <span className="bm-gallery-empty-icon">🖼️</span>
        <span>No images available</span>
      </div>
    );
  }

  return (
    <div className="bm-gallery">
      <div className="bm-gallery-main">
        <button type="button" className="bm-gallery-main-btn" onClick={() => openLightbox(selectedIdx)} title="Click to view larger image">
          <img src={`${API_URL}${sorted[selectedIdx]?.url}`} alt="Bike" className="bm-gallery-main-img" />
        </button>
        {sorted[selectedIdx]?.isPrimary && <span className="bm-gallery-primary-tag">Primary</span>}
      </div>
      {sorted.length > 1 && (
        <div className="bm-gallery-thumbs">
          {sorted.map((img, index) => (
            <button key={img.id} type="button" className={`bm-gallery-thumb${index === selectedIdx ? " active" : ""}`} onClick={() => openLightbox(index)}>
              <img src={`${API_URL}${img.url}`} alt={`Thumb ${index + 1}`} />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div className="bm-lightbox" onClick={() => setLightboxOpen(false)}>
          <button type="button" className="bm-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Close image">✕</button>
          {sorted.length > 1 && (
            <>
              <button type="button" className="bm-lightbox-nav bm-lightbox-prev" onClick={(event) => { event.stopPropagation(); goPrev(); }} aria-label="Previous image">‹</button>
              <button type="button" className="bm-lightbox-nav bm-lightbox-next" onClick={(event) => { event.stopPropagation(); goNext(); }} aria-label="Next image">›</button>
            </>
          )}
          <div className="bm-lightbox-content" onClick={(event) => event.stopPropagation()}>
            <img src={`${API_URL}${sorted[selectedIdx]?.url}`} alt="Bike large preview" className="bm-lightbox-img" />
          </div>
        </div>
      )}
    </div>
  );
}

function ViewVehicleModal({ vehicle: initialVehicle, token, relatedVehicles = [], purchase, onClose }: { vehicle: Vehicle; token: string; relatedVehicles?: Vehicle[]; purchase?: BikePurchase | null; onClose: () => void }) {
  const [vehicle, setVehicle] = useState<Vehicle>(initialVehicle);
  const [images, setImages] = useState<VehicleImage[]>(initialVehicle.images ?? []);
  const [showExpenses, setShowExpenses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bulkPeerVehicles, setBulkPeerVehicles] = useState<Vehicle[]>(relatedVehicles);
  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    void (async () => {
      try {
        const [vehicleResponse, imagesResponse, peersResponse] = await Promise.all([
          fetch(`${base}/vehicles/${initialVehicle.id}`, { headers: auth }),
          fetch(`${base}/vehicles/${initialVehicle.id}/images`, { headers: auth }),
          fetch(`${base}/vehicles?limit=5000`, { headers: auth }),
        ]);

        if (vehicleResponse.ok) {
          const payload = await vehicleResponse.json() as { data: Vehicle };
          setVehicle(payload.data);
          if (payload.data.images?.length) {
            setImages(payload.data.images);
          }
        }
        if (imagesResponse.ok) {
          const payload = await imagesResponse.json() as { data: VehicleImage[] };
          if (payload.data?.length) {
            setImages(payload.data);
          }
        }
        if (peersResponse.ok) {
          const payload = await peersResponse.json() as { data?: { vehicles?: Vehicle[] } };
          setBulkPeerVehicles(payload.data?.vehicles ?? relatedVehicles);
        }
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatCurrency = (value: number) => `Rs. ${value.toLocaleString(undefined, { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  const expenses = vehicle.expenses ?? [];
  const rawTotalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const peerVehicles = bulkPeerVehicles.length > 0 ? bulkPeerVehicles : relatedVehicles;
  const matchingVehicles = peerVehicles
    .filter((candidate) => {
      const matchesCore = (candidate.brand?.id ?? candidate.brand?.name) === (vehicle.brand?.id ?? vehicle.brand?.name)
        && (candidate.model?.id ?? candidate.model?.name) === (vehicle.model?.id ?? vehicle.model?.name)
        && candidate.colour === vehicle.colour
        && (candidate.supplier?.id ?? null) === (vehicle.supplier?.id ?? null)
        && (candidate.year ?? null) === (vehicle.year ?? null)
        && (candidate.registrationType ?? null) === (vehicle.registrationType ?? null)
        && (!vehicle.fileNo || !candidate.fileNo || candidate.fileNo === vehicle.fileNo);

      return candidate.id === vehicle.id || matchesCore;
    })
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return left.id - right.id;
    });
  const selectedIndex = matchingVehicles.findIndex((candidate) => candidate.id === vehicle.id);
  const sameBulkVehicles = selectedIndex === -1 ? [vehicle] : (() => {
    const isNeighborInSameBatch = (left: Vehicle, right: Vehicle) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      const timeGap = Number.isFinite(leftTime) && Number.isFinite(rightTime)
        ? Math.abs(rightTime - leftTime)
        : Number.MAX_SAFE_INTEGER;

      return timeGap <= 15_000 && Math.abs(right.id - left.id) <= 20;
    };

    const batch = [matchingVehicles[selectedIndex]];
    for (let index = selectedIndex - 1; index >= 0; index -= 1) {
      const candidate = matchingVehicles[index];
      if (!isNeighborInSameBatch(candidate, batch[0])) break;
      batch.unshift(candidate);
    }
    for (let index = selectedIndex + 1; index < matchingVehicles.length; index += 1) {
      const candidate = matchingVehicles[index];
      if (!isNeighborInSameBatch(batch[batch.length - 1], candidate)) break;
      batch.push(candidate);
    }
    return batch;
  })();
  const likelyBulkCount = Math.max(1, sameBulkVehicles.length);
  const comparisonBase = vehicle.sellingPrice ?? 0;
  const looksAlreadyPerBike = comparisonBase > 0
    && (vehicle.purchasePrice ?? 0) <= comparisonBase
    && (vehicle.taxAmount ?? 0) <= comparisonBase
    && rawTotalExpenses <= comparisonBase;
  const shouldDivideBulkValues = likelyBulkCount > 1 && !looksAlreadyPerBike && (
    (vehicle.purchasePrice ?? 0) > 0
    || (vehicle.taxAmount ?? 0) > 0
    || rawTotalExpenses > 0
  );
  const divideBulkAmount = (amount?: number) => {
    if (amount == null) return amount;
    return Number((amount / likelyBulkCount).toFixed(2));
  };
  const displayPurchasePrice = shouldDivideBulkValues ? divideBulkAmount(vehicle.purchasePrice) : vehicle.purchasePrice;
  const displayTaxAmount = shouldDivideBulkValues ? divideBulkAmount(vehicle.taxAmount) : vehicle.taxAmount;
  const displayExpenses = shouldDivideBulkValues
    ? expenses.map((expense) => ({ ...expense, amount: divideBulkAmount(expense.amount) ?? 0 }))
    : expenses;
  const displayTotalExpenses = displayExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal bm-view-modal" onClick={(event) => event.stopPropagation()}>
        <button className="bm-modal-close" onClick={onClose}>✕</button>
        <h3 className="bm-modal-title">Sold Product Details — {vehicle.displayId}</h3>
        {loading && <div style={{ textAlign: "center", padding: 12, color: "var(--muted)" }}>Loading details…</div>}

        <div className="bm-view-layout">
          <div className="bm-view-left">
            <ImageGallery images={images} />
            <div className="bm-view-quick-info">
              <div className="bm-view-quick-item"><span className="bm-view-quick-label">Brand</span><span className="bm-view-quick-value">{vehicle.brand.name}</span></div>
              <div className="bm-view-quick-item"><span className="bm-view-quick-label">Model</span><span className="bm-view-quick-value">{vehicle.model.name}</span></div>
              <div className="bm-view-quick-item"><span className="bm-view-quick-label">Supplier</span><span className="bm-view-quick-value">{vehicle.supplier ? `${vehicle.supplier.name} (${vehicle.supplier.code})` : "—"}</span></div>
              <div className="bm-view-quick-item"><span className="bm-view-quick-label">Condition</span><span className="bm-view-quick-value">{vehicle.condition === "used" ? "Used" : vehicle.condition === "brandnew" ? "Brand New" : "—"}</span></div>
            </div>
          </div>

          <div className="bm-view-right">
            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Product Information</h4>
              <div className="bm-view-detail-grid">
                <div className="bm-view-detail"><span className="bm-view-detail-label">Year</span><span className="bm-view-detail-value">{vehicle.year ?? "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Engine Capacity</span><span className="bm-view-detail-value">{vehicle.engineCapacityCc ? `${vehicle.engineCapacityCc} cc` : "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Mileage</span><span className="bm-view-detail-value">{vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()} km` : "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Registration</span><span className="bm-view-detail-value">{vehicle.registrationType === "registered" ? "Registered" : vehicle.registrationType === "unregistered" ? "Unregistered" : "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">File No</span><span className="bm-view-detail-value">{vehicle.fileNo ?? "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Register No</span><span className="bm-view-detail-value">{vehicle.registerNo ?? "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Chassis No</span><span className="bm-view-detail-value">{vehicle.chassisNo ?? "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Engine No</span><span className="bm-view-detail-value">{vehicle.engineNo ?? "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Sold At</span><span className="bm-view-detail-value">{vehicle.soldAt ? new Date(vehicle.soldAt).toLocaleString() : "—"}</span></div>
              </div>
              {vehicle.description && (
                <div className="bm-view-desc">
                  <span className="bm-view-detail-label">Description</span>
                  <p className="bm-view-desc-text">{vehicle.description}</p>
                </div>
              )}
            </div>

            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Pricing</h4>
              <div className="bm-view-detail-grid">
                <div className="bm-view-detail"><span className="bm-view-detail-label">Purchase Price</span><span className="bm-view-detail-value bm-view-price">{displayPurchasePrice != null ? formatCurrency(displayPurchasePrice) : "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Tax Amount</span><span className="bm-view-detail-value bm-view-price">{displayTaxAmount != null ? formatCurrency(displayTaxAmount) : "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Selling Price</span><span className="bm-view-detail-value bm-view-price bm-view-price-highlight">{vehicle.sellingPrice != null ? formatCurrency(vehicle.sellingPrice) : "—"}</span></div>
              </div>
              {shouldDivideBulkValues && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-soft)" }}>
                  Showing the original per-bike values divided across {likelyBulkCount} bikes from the same bulk entry.
                </div>
              )}
            </div>

            {purchase && (
              <div className="bm-view-section">
                <h4 className="bm-view-section-title">Customer Details</h4>
                <div className="bm-view-detail-grid">
                  <div className="bm-view-detail"><span className="bm-view-detail-label">Customer</span><span className="bm-view-detail-value">{purchase.customer.firstName} {purchase.customer.lastName}</span></div>
                  <div className="bm-view-detail"><span className="bm-view-detail-label">NIC</span><span className="bm-view-detail-value">{purchase.customer.nic}</span></div>
                  <div className="bm-view-detail"><span className="bm-view-detail-label">Mobile</span><span className="bm-view-detail-value">{purchase.customer.mobileNumber}</span></div>
                  <div className="bm-view-detail"><span className="bm-view-detail-label">Purchased At</span><span className="bm-view-detail-value">{new Date(purchase.purchasedAt).toLocaleString()}</span></div>
                  <div className="bm-view-detail" style={{ gridColumn: "1 / -1" }}><span className="bm-view-detail-label">Address</span><span className="bm-view-detail-value">{purchase.customer.address}, {purchase.customer.district}, {purchase.customer.province}</span></div>
                </div>
              </div>
            )}

            {(displayExpenses.length > 0 || displayTotalExpenses > 0) && (
              <div className="bm-view-section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h4 className="bm-view-section-title" style={{ margin: 0 }}>Additional Expenses <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-soft)", marginLeft: 8 }}>{formatCurrency(displayTotalExpenses)}</span></h4>
                  {displayExpenses.length > 0 && <button type="button" className="bm-view-toggle-btn" onClick={() => setShowExpenses((value) => !value)}>{showExpenses ? "Hide" : "View Details"}</button>}
                </div>
                {showExpenses && (
                  <div className="bm-view-expenses-table">
                    <table className="data-table" style={{ margin: 0, width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "8px 10px" }}>#</th>
                          <th style={{ textAlign: "left", padding: "8px 10px" }}>Description</th>
                          <th style={{ textAlign: "right", padding: "8px 10px" }}>Amount</th>
                          <th style={{ textAlign: "left", padding: "8px 10px" }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayExpenses.map((expense, index) => (
                          <tr key={expense.id}>
                            <td style={{ padding: "6px 10px" }}>{index + 1}</td>
                            <td style={{ padding: "6px 10px" }}>{expense.description}</td>
                            <td style={{ textAlign: "right", padding: "6px 10px" }}>{formatCurrency(expense.amount)}</td>
                            <td style={{ padding: "6px 10px", fontSize: 12, color: "var(--text-soft)" }}>{new Date(expense.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bm-modal-actions">
          <button type="button" className="btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function SoldBikesPage() {
  const { token } = useAdmin();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [purchasesByBikeId, setPurchasesByBikeId] = useState<Record<number, BikePurchase>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [delConfirm, setDelConfirm] = useState<number | null>(null);
  const [viewVehicle, setViewVehicle] = useState<Vehicle | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [chassisSearch, setChassisSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${base}/vehicles?status=sold&limit=5000`, { headers: auth, cache: "no-store" });
      const payload = await response.json() as { data?: { vehicles?: Vehicle[] }; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load sold products");
      setVehicles(payload.data?.vehicles ?? []);

      const purchaseRes = await fetch(`${API_URL}/api/pos/user-management/purchases?page=1&limit=500`, { headers: auth, cache: "no-store" });
      const purchaseJson = await purchaseRes.json() as { data?: { purchases?: BikePurchase[] }; message?: string };
      if (!purchaseRes.ok) throw new Error(purchaseJson.message ?? "Failed to load purchase records");
      const bikePurchases = (purchaseJson.data?.purchases ?? []).filter((purchase) => !!purchase.bike?.id);
      setPurchasesByBikeId(
        bikePurchases.reduce<Record<number, BikePurchase>>((acc, purchase) => {
          if (purchase.bike?.id) {
            const current = acc[purchase.bike.id];
            if (!current || new Date(purchase.purchasedAt).getTime() > new Date(current.purchasedAt).getTime()) {
              acc[purchase.bike.id] = purchase;
            }
          }
          return acc;
        }, {})
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sold products");
      setVehicles([]);
      setPurchasesByBikeId({});
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const filteredVehicles = useMemo(() => {
    const fromBoundary = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const toBoundary = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
    const chassisNeedle = chassisSearch.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      if (chassisNeedle && !vehicle.chassisNo?.toLowerCase().includes(chassisNeedle)) return false;
      const soldDateRaw = vehicle.soldAt ?? purchasesByBikeId[vehicle.id]?.purchasedAt;
      if (!soldDateRaw) return !fromBoundary && !toBoundary;
      const soldDate = new Date(soldDateRaw);
      if (Number.isNaN(soldDate.getTime())) return !fromBoundary && !toBoundary;
      if (fromBoundary && soldDate < fromBoundary) return false;
      if (toBoundary && soldDate > toBoundary) return false;
      return true;
    });
  }, [chassisSearch, fromDate, toDate, purchasesByBikeId, vehicles]);
  const pagedVehicles = useMemo(() => paginateRows(filteredVehicles, page, pageSize), [filteredVehicles, page, pageSize]);
  useEffect(() => { setPage(1); }, [chassisSearch, fromDate, toDate, pageSize]);

  const restore = async (id: number) => {
    setRestoring(id);
    await fetch(`${base}/vehicles/${id}`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "available" }),
    });
    setRestoring(null);
    void load();
  };

  const deleteSold = async (id: number) => {
    await fetch(`${base}/vehicles/${id}`, { method: "DELETE", headers: auth });
    setDelConfirm(null);
    void load();
  };

  const soldWithImages = filteredVehicles.filter((vehicle) => (vehicle.images ?? []).length > 0).length;
  const soldWithRegister = filteredVehicles.filter((vehicle) => !!vehicle.registerNo).length;
  const totalSoldValue = filteredVehicles.reduce((sum, vehicle) => sum + (vehicle.sellingPrice ?? 0), 0);
  const latestSold = filteredVehicles
    .map((vehicle) => vehicle.soldAt ?? purchasesByBikeId[vehicle.id]?.purchasedAt)
    .filter((value): value is string => typeof value === "string")
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];

  const exportSoldBikesPdf = () => {
    if (typeof window === "undefined") return;

    const generatedAt = new Date().toLocaleString();
    const fromLabel = fromDate || "All";
    const toLabel = toDate || "All";

    const rows = filteredVehicles.map((vehicle) => {
      const purchase = purchasesByBikeId[vehicle.id];
      const soldAt = vehicle.soldAt ?? purchase?.purchasedAt;
      const customer = purchase
        ? `${purchase.customer.firstName} ${purchase.customer.lastName}`
        : "-";

      return `
        <tr>
          <td>${escapeHtml(vehicle.displayId ?? "-")}</td>
          <td>${escapeHtml(vehicle.brand?.name ?? "-")}</td>
          <td>${escapeHtml(vehicle.model?.name ?? "-")}</td>
          <td>${escapeHtml(vehicle.supplier ? `${vehicle.supplier.name} (${vehicle.supplier.code})` : "-")}</td>
          <td>${escapeHtml(customer)}</td>
          <td style="text-align:right;">${vehicle.sellingPrice != null ? `Rs. ${vehicle.sellingPrice.toLocaleString()}` : "-"}</td>
          <td>${soldAt ? escapeHtml(new Date(soldAt).toLocaleString()) : "-"}</td>
        </tr>`;
    }).join("");

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>bike-sold-report</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        color: #111827;
        background: #ffffff;
      }
      .header {
        border-bottom: 2px solid #d4af37;
        padding-bottom: 10px;
        margin-bottom: 14px;
      }
      .title {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
      }
      .subtitle {
        margin-top: 4px;
        font-size: 12px;
        color: #4b5563;
      }
      .meta {
        margin-top: 4px;
        font-size: 11px;
        color: #6b7280;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 14px;
      }
      .card {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px;
      }
      .label {
        font-size: 11px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .value {
        margin-top: 6px;
        font-size: 24px;
        font-weight: 700;
      }
      .section-title {
        margin-top: 10px;
        margin-bottom: 6px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #374151;
        font-weight: 700;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 4px;
      }
      .table th {
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        text-align: left;
        font-size: 11px;
        padding: 7px 8px;
      }
      .table td {
        border: 1px solid #e5e7eb;
        font-size: 11px;
        padding: 7px 8px;
        vertical-align: top;
      }
      .empty {
        border: 1px dashed #d1d5db;
        border-radius: 8px;
        padding: 18px;
        text-align: center;
        color: #6b7280;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1 class="title">Bar Shop Sold Products Report</h1>
      <div class="subtitle">Dashboard-style export for sold drinks and products in the selected date range.</div>
      <div class="meta">Generated: ${escapeHtml(generatedAt)}</div>
      <div class="meta">Date Filter: ${escapeHtml(fromLabel)} to ${escapeHtml(toLabel)}</div>
    </div>

    <div class="grid">
      <div class="card"><div class="label">Total Sold Products</div><div class="value">${filteredVehicles.length}</div></div>
      <div class="card"><div class="label">Sold Value</div><div class="value">LKR ${totalSoldValue.toLocaleString()}</div></div>
      <div class="card"><div class="label">With Images</div><div class="value">${soldWithImages}</div></div>
      <div class="card"><div class="label">Registered Products</div><div class="value">${soldWithRegister}</div></div>
    </div>

    <div class="section-title">Sold Product List</div>
    ${filteredVehicles.length === 0 ? '<div class="empty">No sold products found for the selected filters.</div>' : `
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Brand</th>
            <th>Model</th>
            <th>Supplier</th>
            <th>Customer</th>
            <th>Selling Price</th>
            <th>Sold At</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `}
  </body>
</html>`;

    const printFrame = document.createElement("iframe");
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.style.opacity = "0";

    const cleanup = () => {
      window.setTimeout(() => {
        if (printFrame.parentNode) {
          printFrame.parentNode.removeChild(printFrame);
        }
      }, 1000);
    };

    printFrame.onload = () => {
      const frameWindow = printFrame.contentWindow;
      if (!frameWindow) {
        cleanup();
        return;
      }
      frameWindow.requestAnimationFrame(() => {
        window.setTimeout(() => {
          frameWindow.focus();
          frameWindow.print();
          cleanup();
        }, 120);
      });
    };

    document.body.appendChild(printFrame);
    printFrame.srcdoc = html;
  };

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconBike /></div>
          <div>
            <h2 className="page-title">Sold Drinks & Products</h2>
            <p className="page-subtitle">{filteredVehicles.length} bike{filteredVehicles.length !== 1 ? "s" : ""} sold</p>
          </div>
        </div>
        <button type="button" className="btn-outline" onClick={exportSoldBikesPdf}>Export PDF</button>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="bm-stats-grid">
        <div className="bm-stat-card bm-stat-card-danger">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconBike /></span><span className="bm-stat-label">Total Sold</span></div>
          <strong className="bm-stat-value">{filteredVehicles.length}</strong>
          <span className="bm-stat-sub">Sold inventory records</span>
        </div>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconInvoice /></span><span className="bm-stat-label">Sold Value</span></div>
          <strong className="bm-stat-value">Rs. {totalSoldValue.toLocaleString()}</strong>
          <span className="bm-stat-sub">Based on selling price</span>
        </div>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconInventory /></span><span className="bm-stat-label">With Images</span></div>
          <strong className="bm-stat-value">{soldWithImages}</strong>
          <span className="bm-stat-sub">Visual sales records</span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconActivity /></span><span className="bm-stat-label">Registered</span></div>
          <strong className="bm-stat-value">{soldWithRegister}</strong>
          <span className="bm-stat-sub">Latest sale: {latestSold ? new Date(latestSold).toLocaleDateString() : "—"}</span>
        </div>
      </div>

      <div className="bm-table-card">
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--panel-border)", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <label htmlFor="sold-bikes-chassis" style={{ fontSize: 13, color: "var(--text-soft)" }}>Chassis No</label>
          <input
            id="sold-bikes-chassis"
            className="bm-input"
            style={{ maxWidth: 280 }}
            type="search"
            value={chassisSearch}
            onChange={(event) => setChassisSearch(event.target.value)}
            placeholder="Search chassis number"
          />
          <label htmlFor="sold-bikes-from" style={{ fontSize: 13, color: "var(--text-soft)" }}>From</label>
          <input
            id="sold-bikes-from"
            className="bm-input"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
          <label htmlFor="sold-bikes-to" style={{ fontSize: 13, color: "var(--text-soft)" }}>To</label>
          <input
            id="sold-bikes-to"
            className="bm-input"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
          <button type="button" className="btn-outline" onClick={() => { setChassisSearch(""); setFromDate(""); setToDate(""); }}>Clear Filters</button>
          <button type="button" className="btn-outline" onClick={() => void load()}>Refresh</button>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 72 }}>Image</th>
                <th>ID</th>
                <th>Product</th>
                <th>Supplier</th>
                <th>Customer</th>
                <th>Selling Price</th>
                <th>Sold At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="bm-table-empty">Loading…</td></tr>}
              {!loading && filteredVehicles.length === 0 && <tr><td colSpan={8} className="bm-table-empty">No sold products for the selected filters.</td></tr>}
              {!loading && pagedVehicles.map((vehicle) => {
                const primaryImg = (vehicle.images ?? []).find((img) => img.isPrimary) ?? (vehicle.images ?? [])[0];
                const purchase = purchasesByBikeId[vehicle.id];
                return (
                  <>
                    <tr key={vehicle.id} className="bm-vehicle-row">
                      <td>{primaryImg ? <img src={`${API_URL}${primaryImg.url}`} alt="" className="bm-row-thumb" /> : <span className="bm-row-thumb-empty">🖼️</span>}</td>
                      <td><span className="bm-display-id">{vehicle.displayId}</span></td>
                      <td>
                        <span className="bm-vehicle-detail">{vehicle.brand.name} · {vehicle.model.name}</span>
                        <span className="bm-vehicle-meta">{vehicle.colour}{vehicle.year ? ` · ${vehicle.year}` : ""}</span>
                        <span className="bm-vehicle-meta">{vehicle.engineCapacityCc ? `${vehicle.engineCapacityCc} cc` : "No engine capacity"}</span>
                        <span className="bm-vehicle-meta">Chassis: {vehicle.chassisNo ?? "—"}</span>
                      </td>
                      <td>{vehicle.supplier ? `${vehicle.supplier.name} (${vehicle.supplier.code})` : <em className="bm-missing">—</em>}</td>
                      <td>
                        {purchase
                          ? <span className="bm-vehicle-meta">{purchase.customer.firstName} {purchase.customer.lastName}<br />{purchase.customer.mobileNumber}</span>
                          : <em className="bm-missing">No customer</em>}
                      </td>
                      <td>{vehicle.sellingPrice != null ? `Rs. ${vehicle.sellingPrice.toLocaleString()}` : <em className="bm-missing">—</em>}</td>
                      <td>{vehicle.soldAt ? new Date(vehicle.soldAt).toLocaleDateString() : "—"}</td>
                      <td>
                        <div className="bm-row-actions">
                          <button type="button" className="bm-action-btn bm-view-btn" onClick={() => setViewVehicle(vehicle)} title="View details">View</button>
                          <button type="button" className="bm-action-btn bm-restore-btn" onClick={() => restore(vehicle.id)} disabled={restoring === vehicle.id} title="Mark as available">{restoring === vehicle.id ? "…" : "↩ Restore"}</button>
                          <button type="button" className="bm-action-btn bm-del-btn" onClick={() => setDelConfirm(vehicle.id)} title="Delete permanently">🗑</button>
                        </div>
                      </td>
                    </tr>
                    {delConfirm === vehicle.id && (
                      <tr key={`del-${vehicle.id}`}>
                        <td colSpan={8}>
                          <div className="bm-inline-confirm">
                            <span>Delete <strong>{vehicle.displayId}</strong> permanently?</span>
                            <button className="bm-btn-danger" onClick={() => deleteSold(vehicle.id)}>Delete</button>
                            <button className="btn-outline" onClick={() => setDelConfirm(null)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={filteredVehicles.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {viewVehicle && <ViewVehicleModal vehicle={viewVehicle} relatedVehicles={filteredVehicles} token={token} purchase={purchasesByBikeId[viewVehicle.id]} onClose={() => setViewVehicle(null)} />}
    </div>
  );
}
