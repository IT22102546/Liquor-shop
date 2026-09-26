"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../../components/AdminContext";
import { API_URL } from "../../../lib/constants";
import { IconActivity, IconBoxIn, IconInventory, IconInvoice } from "../../../lib/icons";
import { canAccessPath } from "../../../lib/roles";
import { AddLiquorModal } from "../../../components/products/AddLiquorModal";
import { ProductStockTable } from "../../../components/products/ProductStockTable";
import type { Product } from "../../../components/products/ProductFormModal";
import TablePagination, { paginateRows } from "../../../components/TablePagination";

type ProductBrand = { id: number; name: string; _count?: { products: number } };
type ProductCategory = { id: number; name: string; _count?: { products: number } };

export default function InventoryManagePage() {
  const { admin, token, logout } = useAdmin();
  const [showAddLiquor, setShowAddLiquor] = useState(false);
  // Cashiers can view Product Setup; only "Returned to supplier" works for them.
  const canEdit = admin.role === "ADMIN" || admin.role === "INVENTORY_MANAGER";
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brandDraft, setBrandDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingBrandId, setEditingBrandId] = useState<number | null>(null);
  const [editingBrandName, setEditingBrandName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [brandPage, setBrandPage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const base = `${API_URL}/api/pos/inventory-management`;
  const auth = { Authorization: `Bearer ${token}` };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [brandResponse, categoryResponse, productResponse] = await Promise.all([
        fetch(`${base}/product-brands`, { headers: auth }),
        fetch(`${base}/product-categories`, { headers: auth }),
        fetch(`${base}/products?limit=5000`, { headers: auth }),
      ]);

      const [brandPayload, categoryPayload, productPayload] = await Promise.all([
        brandResponse.json(),
        categoryResponse.json(),
        productResponse.json(),
      ]) as [
        { data?: ProductBrand[]; message?: string },
        { data?: ProductCategory[]; message?: string },
        { data?: { products?: Product[] }; message?: string },
      ];

      if (!brandResponse.ok) throw new Error(brandPayload.message ?? "Failed to load brands");
      if (!categoryResponse.ok) throw new Error(categoryPayload.message ?? "Failed to load categories");
      if (!productResponse.ok) throw new Error(productPayload.message ?? "Failed to load products");

      setBrands(brandPayload.data ?? []);
      setCategories(categoryPayload.data ?? []);
      setProducts(productPayload.data?.products ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load manage data");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { void loadData(); }, [loadData]);

  const totalQty = useMemo(() => products.reduce((sum, product) => sum + product.quantity, 0), [products]);
  const totalSoldQty = useMemo(() => products.reduce((sum, product) => sum + (product.soldQuantity ?? 0), 0), [products]);
  const pagedBrands = useMemo(() => paginateRows(brands, brandPage, pageSize), [brands, brandPage, pageSize]);
  const pagedCategories = useMemo(() => paginateRows(categories, categoryPage, pageSize), [categories, categoryPage, pageSize]);
  useEffect(() => { setBrandPage(1); setCategoryPage(1); }, [pageSize]);

  const saveBrand = async () => {
    if (!brandDraft.trim()) return;
    const response = await fetch(`${base}/product-brands`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: brandDraft.trim() }),
    });
    const payload = await response.json() as { data?: ProductBrand; message?: string };
    if (!response.ok || !payload.data) {
      setError(payload.message ?? "Failed to save brand");
      return;
    }
    setBrands((current) => [...current, payload.data!].sort((left, right) => left.name.localeCompare(right.name)));
    setBrandDraft("");
  };

  const saveCategory = async () => {
    if (!categoryDraft.trim()) return;
    const response = await fetch(`${base}/product-categories`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryDraft.trim() }),
    });
    const payload = await response.json() as { data?: ProductCategory; message?: string };
    if (!response.ok || !payload.data) {
      setError(payload.message ?? "Failed to save category");
      return;
    }
    setCategories((current) => [...current, payload.data!].sort((left, right) => left.name.localeCompare(right.name)));
    setCategoryDraft("");
  };

  const updateBrand = async () => {
    if (!editingBrandId || !editingBrandName.trim()) return;
    const response = await fetch(`${base}/product-brands/${editingBrandId}`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingBrandName.trim() }),
    });
    const payload = await response.json() as { data?: ProductBrand; message?: string };
    if (!response.ok || !payload.data) {
      setError(payload.message ?? "Failed to update brand");
      return;
    }
    setBrands((current) => current.map((brand) => brand.id === editingBrandId ? payload.data! : brand).sort((left, right) => left.name.localeCompare(right.name)));
    setEditingBrandId(null);
    setEditingBrandName("");
    void loadData();
  };

  const updateCategory = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    const response = await fetch(`${base}/product-categories/${editingCategoryId}`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingCategoryName.trim() }),
    });
    const payload = await response.json() as { data?: ProductCategory; message?: string };
    if (!response.ok || !payload.data) {
      setError(payload.message ?? "Failed to update category");
      return;
    }
    setCategories((current) => current.map((category) => category.id === editingCategoryId ? payload.data! : category).sort((left, right) => left.name.localeCompare(right.name)));
    setEditingCategoryId(null);
    setEditingCategoryName("");
    void loadData();
  };

  const removeBrand = async (id: number) => {
    if (!window.confirm("Delete this brand and linked inventory products?")) return;
    const response = await fetch(`${base}/product-brands/${id}`, { method: "DELETE", headers: auth });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setError(payload?.message ?? "Failed to delete brand");
      return;
    }
    setBrands((current) => current.filter((brand) => brand.id !== id));
    void loadData();
  };

  const removeCategory = async (id: number) => {
    if (!window.confirm("Delete this category and linked inventory products?")) return;
    const response = await fetch(`${base}/product-categories/${id}`, { method: "DELETE", headers: auth });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setError(payload?.message ?? "Failed to delete category");
      return;
    }
    setCategories((current) => current.filter((category) => category.id !== id));
    void loadData();
  };

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconInventory /></div>
          <div>
            <h2 className="page-title">Manage Product Catalog</h2>
            <p className="page-subtitle">
              {canEdit
                ? "Add liquor by barcode or by hand, and keep brands and categories organized."
                : "View products, stock and prices. You can record empty bottles returned to the supplier."}
            </p>
          </div>
        </div>
        {canEdit ? (
          <button type="button" className="btn-accent pos-add-liquor" onClick={() => setShowAddLiquor(true)}>
            <IconBoxIn /> Add liquor
          </button>
        ) : (
          <span className="lx-readonly-pill">View only</span>
        )}
      </div>

      {(canAccessPath(admin.role, "/dashboard/inventory") || canAccessPath(admin.role, "/dashboard/inventory/sold")) && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {canAccessPath(admin.role, "/dashboard/inventory") && <Link href="/dashboard/inventory" className="btn-outline">Bar Counter</Link>}
          {canAccessPath(admin.role, "/dashboard/inventory/sold") && <Link href="/dashboard/inventory/sold" className="btn-outline">Sold Drinks</Link>}
        </div>
      )}

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="bm-stats-grid">
        <div className="bm-stat-card bm-stat-card-soft"><div className="bm-stat-head"><span className="bm-stat-icon"><IconInventory /></span><span className="bm-stat-label">Brands</span></div><strong className="bm-stat-value">{brands.length}</strong><span className="bm-stat-sub">Beverage and product brands configured</span></div>
        <div className="bm-stat-card"><div className="bm-stat-head"><span className="bm-stat-icon"><IconActivity /></span><span className="bm-stat-label">Categories</span></div><strong className="bm-stat-value">{categories.length}</strong><span className="bm-stat-sub">Drink and product categories available</span></div>
        <div className="bm-stat-card bm-stat-card-soft"><div className="bm-stat-head"><span className="bm-stat-icon"><IconInvoice /></span><span className="bm-stat-label">Mapped Products</span></div><strong className="bm-stat-value">{products.length}</strong><span className="bm-stat-sub">In stock: {totalQty}</span></div>
        <div className="bm-stat-card"><div className="bm-stat-head"><span className="bm-stat-icon"><IconActivity /></span><span className="bm-stat-label">Sold Units</span></div><strong className="bm-stat-value">{totalSoldQty}</strong><span className="bm-stat-sub">Recorded from inventory sales</span></div>
      </div>

      <ProductStockTable
        token={token}
        products={products}
        brands={brands}
        categories={categories}
        loading={loading}
        canEdit={canEdit}
        onChanged={() => void loadData()}
        onAuthExpired={logout}
      />

      <div className="bm-manage-grid">
        <div className="bm-manage-col">
          <div className="bm-col-header"><span className="bm-col-title">Brand Management</span><span className="bm-col-count">{brands.length}</span></div>
          {canEdit && <div className="bm-quick-add-row">
            <input className="bm-input" value={brandDraft} onChange={(event) => setBrandDraft(event.target.value)} placeholder="Add new brand" />
            <button type="button" className="btn-accent bm-add-btn" onClick={() => void saveBrand()}>Save</button>
          </div>}
          <div className="bm-list">
            {loading && <div className="bm-table-empty">Loading brands...</div>}
            {!loading && pagedBrands.map((brand) => (
              <div key={brand.id} className="bm-list-item">
                {editingBrandId === brand.id ? (
                  <div className="bm-edit-row">
                    <input className="bm-input bm-input-sm" value={editingBrandName} onChange={(event) => setEditingBrandName(event.target.value)} />
                    <button type="button" className="bm-action-btn bm-save-btn" onClick={() => void updateBrand()}>✓</button>
                    <button type="button" className="bm-action-btn bm-cancel-btn" onClick={() => setEditingBrandId(null)}>✕</button>
                  </div>
                ) : (
                  <>
                    <div className="bm-item-name-btn">
                      <span className="bm-item-name">{brand.name}</span>
                      <span className="bm-item-meta">{brand._count?.products ?? 0} products</span>
                    </div>
                    {canEdit && <div className="bm-actions">
                      <button type="button" className="bm-action-btn bm-edit-btn" onClick={() => { setEditingBrandId(brand.id); setEditingBrandName(brand.name); }}>✎</button>
                      <button type="button" className="bm-action-btn bm-del-btn" onClick={() => void removeBrand(brand.id)}>🗑</button>
                    </div>}
                  </>
                )}
              </div>
            ))}
          </div>
          <TablePagination page={brandPage} pageSize={pageSize} total={brands.length} onPageChange={setBrandPage} onPageSizeChange={setPageSize} />
        </div>

        <div className="bm-manage-col">
          <div className="bm-col-header"><span className="bm-col-title">Category Management</span><span className="bm-col-count">{categories.length}</span></div>
          {canEdit && <div className="bm-quick-add-row">
            <input className="bm-input" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} placeholder="Add new category" />
            <button type="button" className="btn-accent bm-add-btn" onClick={() => void saveCategory()}>Save</button>
          </div>}
          <div className="bm-list">
            {loading && <div className="bm-table-empty">Loading categories...</div>}
            {!loading && pagedCategories.map((category) => (
              <div key={category.id} className="bm-list-item">
                {editingCategoryId === category.id ? (
                  <div className="bm-edit-row">
                    <input className="bm-input bm-input-sm" value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} />
                    <button type="button" className="bm-action-btn bm-save-btn" onClick={() => void updateCategory()}>✓</button>
                    <button type="button" className="bm-action-btn bm-cancel-btn" onClick={() => setEditingCategoryId(null)}>✕</button>
                  </div>
                ) : (
                  <>
                    <div className="bm-item-name-btn">
                      <span className="bm-item-name">{category.name}</span>
                      <span className="bm-item-meta">{category._count?.products ?? 0} products</span>
                    </div>
                    {canEdit && <div className="bm-actions">
                      <button type="button" className="bm-action-btn bm-edit-btn" onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); }}>✎</button>
                      <button type="button" className="bm-action-btn bm-del-btn" onClick={() => void removeCategory(category.id)}>🗑</button>
                    </div>}
                  </>
                )}
              </div>
            ))}
          </div>
          <TablePagination page={categoryPage} pageSize={pageSize} total={categories.length} onPageChange={setCategoryPage} onPageSizeChange={setPageSize} />
        </div>
      </div>
      {canEdit && showAddLiquor && (
        <AddLiquorModal
          token={token}
          onClose={() => setShowAddLiquor(false)}
          onStockChanged={() => void loadData()}
          onAuthExpired={logout}
        />
      )}
    </div>
  );
}
