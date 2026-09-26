"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../lib/constants";
import { IconBottle, IconSearch } from "../../lib/icons";
import { ProductArt } from "./ProductArt";
import {
  formatCurrency,
  ProductModal,
  type Product,
  type ProductBrand,
  type ProductCategory,
  type Supplier,
} from "./ProductFormModal";

type ProductStockTableProps = {
  token: string;
  products: Product[];
  brands: ProductBrand[];
  categories: ProductCategory[];
  loading: boolean;
  /** False for cashiers: everything is read-only except "Returned to supplier". */
  canEdit: boolean;
  onChanged: () => void;
  onAuthExpired: () => void;
};

/**
 * Product list for Product Setup: edit prices (including the empty-bottle price), see how many
 * empties are waiting, and record empties handed back to the supplier.
 */
export function ProductStockTable({ token, products, brands, categories, loading, canEdit, onChanged, onAuthExpired }: ProductStockTableProps) {
  const base = `${API_URL}/api/pos/inventory-management`;
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [returning, setReturning] = useState<Product | null>(null);
  const [returnQty, setReturnQty] = useState("");
  const [saving, setSaving] = useState(false);
  // Quick "+ Stock": add received units right in the table, without opening the edit form.
  const [stocking, setStocking] = useState<{ id: number; qty: string; cost: string } | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    void fetch(`${base}/suppliers`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data?: Supplier[] } | null) => setSuppliers(json?.data ?? []))
      .catch(() => setSuppliers([]));
  }, [base, editing, token]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products
      .filter((product) => !needle || [product.name, product.brand.name, product.category.name, product.partNumber]
        .some((value) => value?.toLowerCase().includes(needle)))
      .sort((a, b) => a.category.name.localeCompare(b.category.name) || a.name.localeCompare(b.name));
  }, [products, search]);

  const emptiesOnHand = products.reduce((sum, product) => sum + (product.emptyBottlesOnHand ?? 0), 0);
  const emptiesValue = products.reduce((sum, product) => sum + (product.emptyBottlesOnHand ?? 0) * (product.emptyBottlePrice ?? 0), 0);

  const submitStock = async () => {
    if (!stocking) return;
    const quantity = Math.floor(Number(stocking.qty));
    if (!Number.isFinite(quantity) || quantity < 1) {
      setError("Enter how many units arrived.");
      return;
    }
    const cost = Number(stocking.cost);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${base}/products/${stocking.id}/restock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, ...(stocking.cost.trim() && Number.isFinite(cost) ? { purchasePrice: cost } : {}) }),
      });
      if (response.status === 401) { onAuthExpired(); return; }
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(payload?.message ?? "Could not add stock");
        return;
      }
      setFlashId(stocking.id);
      window.setTimeout(() => setFlashId(null), 1200);
      setStocking(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const submitReturn = async () => {
    if (!returning) return;
    const quantity = Math.floor(Number(returnQty));
    if (!Number.isFinite(quantity) || quantity < 1) {
      setError("Enter how many empty bottles went back to the supplier.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${base}/products/${returning.id}/empties/return`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (response.status === 401) { onAuthExpired(); return; }
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(payload?.message ?? "Failed to record returned empties");
        return;
      }
      setReturning(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bm-table-card lx-products-card">
      <div className="lx-products-head">
        <div>
          <h3 className="lx-card-title">Products &amp; empty bottles</h3>
          <p className="lx-card-sub">
            {products.length} products · <strong>{emptiesOnHand}</strong> empty bottle{emptiesOnHand === 1 ? "" : "s"} on hand
            {emptiesValue > 0 ? ` (worth ${formatCurrency(emptiesValue)})` : ""}
          </p>
        </div>
        <div className="pos-search-field">
          <IconSearch />
          <input className="bm-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or barcode" aria-label="Search products" />
        </div>
      </div>

      {error && !returning && <div className="bm-alert bm-alert-error" style={{ margin: "0.75rem 1.25rem 0" }}>{error}</div>}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Barcode</th>
              <th style={{ textAlign: "right" }}>In stock</th>
              <th style={{ textAlign: "right" }}>Selling price</th>
              <th style={{ textAlign: "right" }}>Empty price</th>
              <th style={{ textAlign: "right" }}>Empties on hand</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="bm-table-empty">Loading products…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="bm-table-empty">{products.length === 0 ? "No products yet — use Add liquor to add your first bottles." : "No products match your search."}</td></tr>
            )}
            {!loading && rows.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="lx-product-cell">
                    <ProductArt className="lx-mini-art" categoryName={product.category.name} imageUrl={product.images?.[0]?.url} alt={product.name} iconSize={18} />
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.brand.name} · {product.category.name}</span>
                    </div>
                  </div>
                </td>
                <td className="td-muted">{product.partNumber || "—"}</td>
                <td style={{ textAlign: "right" }}><span className={flashId === product.id ? "lx-stock-flash" : undefined}>{product.quantity}</span></td>
                <td style={{ textAlign: "right" }}>{product.sellingPrice != null ? formatCurrency(product.sellingPrice) : "—"}</td>
                <td style={{ textAlign: "right" }}>
                  {product.emptyBottlePrice ? formatCurrency(product.emptyBottlePrice) : <span className="td-muted">Not returnable</span>}
                </td>
                <td style={{ textAlign: "right" }}>
                  {product.emptyBottlePrice || product.emptyBottlesOnHand
                    ? <span className={`lx-empties-count${(product.emptyBottlesOnHand ?? 0) > 0 ? " has" : ""}`}><IconBottle /> {product.emptyBottlesOnHand ?? 0}</span>
                    : <span className="td-muted">—</span>}
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {canEdit && stocking?.id === product.id ? (
                    <form className="lx-quick-stock" onSubmit={(event) => { event.preventDefault(); void submitStock(); }}>
                      <input className="bm-input" type="number" min={1} value={stocking.qty} onChange={(event) => setStocking({ ...stocking, qty: event.target.value })} placeholder="Qty" aria-label={`Units of ${product.name} received`} autoFocus />
                      <input className="bm-input cost" type="number" min={0} step="0.01" value={stocking.cost} onChange={(event) => setStocking({ ...stocking, cost: event.target.value })} placeholder="Total cost" aria-label="Total cost paid (optional)" />
                      <button type="submit" className="btn-outline lx-row-btn primary" disabled={saving}>{saving ? "…" : "Add"}</button>
                      <button type="button" className="btn-outline lx-row-btn" onClick={() => setStocking(null)} aria-label="Cancel">✕</button>
                    </form>
                  ) : canEdit && (
                    <button type="button" className="btn-outline lx-row-btn primary" onClick={() => { setStocking({ id: product.id, qty: "", cost: "" }); setError(null); }}>+ Stock</button>
                  )}
                  {(product.emptyBottlesOnHand ?? 0) > 0 && (
                    <button type="button" className="btn-outline lx-row-btn" onClick={() => { setReturning(product); setReturnQty(String(product.emptyBottlesOnHand)); setError(null); }}>
                      Returned to supplier
                    </button>
                  )}
                  {canEdit && <button type="button" className="btn-outline lx-row-btn" onClick={() => setEditing(product)}>Edit</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {returning && (
        <div className="bm-modal-backdrop" onClick={() => setReturning(null)}>
          <div className="bm-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="bm-modal-title">Empties returned to supplier</h3>
            <p className="bm-modal-body">
              <strong>{returning.name}</strong> — {returning.emptyBottlesOnHand} empty bottle{returning.emptyBottlesOnHand === 1 ? "" : "s"} on hand.
              How many did the supplier take back?
            </p>
            {error && <div className="bm-alert bm-alert-error">{error}</div>}
            <input
              className="bm-input"
              type="number"
              min={1}
              max={returning.emptyBottlesOnHand}
              value={returnQty}
              onChange={(event) => setReturnQty(event.target.value)}
              autoFocus
            />
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setReturning(null)}>Cancel</button>
              <button type="button" className="btn-accent" disabled={saving} onClick={() => void submitReturn()}>{saving ? "Saving…" : "Record return"}</button>
            </div>
          </div>
        </div>
      )}

      {canEdit && editing && (
        <ProductModal
          token={token}
          brands={brands}
          categories={categories}
          suppliers={suppliers}
          product={editing}
          existingProducts={products}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
          onPhotosChanged={onChanged}
          onBrandCreated={onChanged}
          onCategoryCreated={onChanged}
          onSupplierCreated={(supplier) => setSuppliers((current) => [...current, supplier])}
          onAuthExpired={onAuthExpired}
        />
      )}
    </section>
  );
}
