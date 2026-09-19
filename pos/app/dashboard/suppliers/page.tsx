"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { exportTableToPdf } from "../../lib/pdf-export";
import { IconInventory, IconSupplier } from "../../lib/icons";
import TablePagination, { paginateRows } from "../../components/TablePagination";

type Supplier = {
  id: number;
  name: string;
  code: string;
  contactPerson?: string;
  telephone?: string;
  address?: string;
  fax?: string;
  email?: string;
  vatRegistrationNo?: string;
  _count?: { vehicles: number; products: number };
};

type ProductImage = {
  id: number;
  productId: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
};

type InventoryProduct = {
  id: number;
  displayId: string;
  name: string;
  quantity: number;
  purchasePrice?: number;
  taxPaid?: number;
  additionalExpenses?: number;
  sellingPrice?: number;
  description?: string;
  brand: { id?: number; name: string };
  category: { id?: number; name: string };
  supplier?: { id: number; name: string; code: string } | null;
  images?: ProductImage[];
  createdAt: string;
};

type SupplierFormState = {
  name: string;
  contactPerson: string;
  telephone: string;
  address: string;
  fax: string;
  email: string;
  vatRegistrationNo: string;
};

type ConfirmState = { id: number; name: string } | null;

function ViewInventoryProductModal({ product, token, onClose }: { product: InventoryProduct; token: string; onClose: () => void }) {
  const [detail, setDetail] = useState<InventoryProduct>(product);
  const [images, setImages] = useState<ProductImage[]>(product.images ?? []);
  const [loading, setLoading] = useState(true);
  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    void (async () => {
      try {
        const [productResponse, imageResponse] = await Promise.all([
          fetch(`${base}/products/${product.id}`, { headers: auth }),
          fetch(`${base}/products/${product.id}/images`, { headers: auth }),
        ]);
        if (productResponse.ok) {
          const payload = await productResponse.json() as { data: InventoryProduct };
          setDetail(payload.data);
        }
        if (imageResponse.ok) {
          const payload = await imageResponse.json() as { data: ProductImage[] };
          setImages(payload.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal bm-view-modal" onClick={(event) => event.stopPropagation()}>
        <button className="bm-modal-close" onClick={onClose}>✕</button>
        <h3 className="bm-modal-title">Product Details — {detail.displayId}</h3>
        {loading && <div style={{ textAlign: "center", padding: 12, color: "var(--text-soft)" }}>Loading product details…</div>}
        <div className="bm-view-layout">
          <div className="bm-view-left">
            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Images</h4>
              {images.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                  {images.map((image) => (
                    <img key={image.id} src={`${API_URL}${image.url}`} alt="Product" className="bm-row-thumb" style={{ width: "100%", height: 120, borderRadius: 10, objectFit: "cover" }} />
                  ))}
                </div>
              ) : (
                <div className="bm-gallery-empty"><span className="bm-gallery-empty-icon">🖼️</span><span>No images available</span></div>
              )}
            </div>
          </div>

          <div className="bm-view-right">
            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Product Information</h4>
              <div className="bm-view-detail-grid">
                <div className="bm-view-detail"><span className="bm-view-detail-label">Product Name</span><span className="bm-view-detail-value">{detail.name}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Brand</span><span className="bm-view-detail-value">{detail.brand.name}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Category</span><span className="bm-view-detail-value">{detail.category.name}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Quantity</span><span className="bm-view-detail-value">{detail.quantity}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Supplier</span><span className="bm-view-detail-value">{detail.supplier ? `${detail.supplier.name} (${detail.supplier.code})` : "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Added On</span><span className="bm-view-detail-value">{new Date(detail.createdAt).toLocaleDateString()}</span></div>
              </div>
              {detail.description && (
                <div className="bm-view-desc">
                  <span className="bm-view-detail-label">Description</span>
                  <p className="bm-view-desc-text">{detail.description}</p>
                </div>
              )}
            </div>
            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Pricing</h4>
              <div className="bm-view-detail-grid">
                <div className="bm-view-detail"><span className="bm-view-detail-label">Purchase Price</span><span className="bm-view-detail-value bm-view-price">{detail.purchasePrice != null ? `Rs. ${detail.purchasePrice.toLocaleString()}` : "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Tax Paid</span><span className="bm-view-detail-value bm-view-price">{detail.taxPaid != null ? `Rs. ${detail.taxPaid.toLocaleString()}` : "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Additional Expenses</span><span className="bm-view-detail-value bm-view-price">{detail.additionalExpenses != null ? `Rs. ${detail.additionalExpenses.toLocaleString()}` : "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Selling Price</span><span className="bm-view-detail-value bm-view-price bm-view-price-highlight">{detail.sellingPrice != null ? `Rs. ${detail.sellingPrice.toLocaleString()}` : "—"}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="bm-modal-actions"><button type="button" className="btn-outline" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function ViewSupplierModal({ supplier, token, onClose }: { supplier: Supplier; token: string; onClose: () => void }) {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };
  const linkedProducts = products.length || supplier._count?.products || 0;
  const hasContactDetails = !!(supplier.contactPerson || supplier.telephone || supplier.email || supplier.fax);

  useEffect(() => {
    void (async () => {
      try {
        const productResponse = await fetch(`${base}/products?limit=5000`, { headers: auth });
        const productPayload = await productResponse.json().catch(() => null) as { data?: { products?: InventoryProduct[] } } | null;
        const allProducts = productPayload?.data?.products ?? [];
        setProducts(allProducts.filter((product) => product.supplier?.id === supplier.id));
      } finally {
        setLoadingProducts(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier.id]);

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal bm-view-modal" onClick={(event) => event.stopPropagation()}>
        <button className="bm-modal-close" onClick={onClose}>✕</button>
        <h3 className="bm-modal-title">Supplier Details — {supplier.name}</h3>

        <div className="bm-view-layout">
          <div className="bm-view-left">
            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Overview</h4>
              <div className="bm-view-quick-info" style={{ gridTemplateColumns: "1fr" }}>
                <div className="bm-view-quick-item">
                  <span className="bm-view-quick-label">Supplier Name</span>
                  <span className="bm-view-quick-value">{supplier.name}</span>
                </div>
                <div className="bm-view-quick-item">
                  <span className="bm-view-quick-label">Supplier Code</span>
                  <span className="bm-view-quick-value">{supplier.code}</span>
                </div>
                <div className="bm-view-quick-item">
                  <span className="bm-view-quick-label">Linked Products</span>
                  <span className="bm-view-quick-value">{linkedProducts}</span>
                </div>
                <div className="bm-view-quick-item">
                  <span className="bm-view-quick-label">Contact Status</span>
                  <span className="bm-view-quick-value">{hasContactDetails ? "Available" : "No contact details"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bm-view-right">
            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Contact Information</h4>
              <div className="bm-view-detail-grid">
                <div className="bm-view-detail"><span className="bm-view-detail-label">Contact Person</span><span className="bm-view-detail-value">{supplier.contactPerson || "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Telephone</span><span className="bm-view-detail-value">{supplier.telephone || "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Email</span><span className="bm-view-detail-value">{supplier.email || "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Fax</span><span className="bm-view-detail-value">{supplier.fax || "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">VAT Registration No</span><span className="bm-view-detail-value">{supplier.vatRegistrationNo || "—"}</span></div>
              </div>
            </div>

            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Address</h4>
              <div className="bm-view-desc">
                <span className="bm-view-detail-label">Supplier Address</span>
                <p className="bm-view-desc-text">{supplier.address || "No address provided"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bm-view-section">
          <h4 className="bm-view-section-title">Products Under This Supplier</h4>
          {loadingProducts ? (
            <p className="bm-empty" style={{ padding: "1rem 0" }}>Loading linked products…</p>
          ) : products.length === 0 ? (
            <p className="bm-empty" style={{ padding: "1rem 0" }}>No products are linked to this supplier yet.</p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Selling Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const primaryImg = (product.images ?? []).find((img) => img.isPrimary) ?? (product.images ?? [])[0];
                    return (
                      <tr key={product.id}>
                        <td>{primaryImg ? <img src={`${API_URL}${primaryImg.url}`} alt="" className="bm-row-thumb" /> : <span className="bm-row-thumb-empty">🖼️</span>}</td>
                        <td>
                          <span className="bm-vehicle-detail">{product.name}</span>
                          <span className="bm-vehicle-meta">{product.brand.name} · {product.displayId}</span>
                        </td>
                        <td>{product.category.name}</td>
                        <td>{product.quantity}</td>
                        <td>{product.sellingPrice != null ? `Rs. ${product.sellingPrice.toLocaleString()}` : "—"}</td>
                        <td>
                          <button type="button" className="bm-action-btn bm-view-btn" onClick={() => setSelectedProduct(product)} title="View product details">View</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bm-modal-actions">
          <button type="button" className="btn-outline" onClick={onClose}>Close</button>
        </div>

        {selectedProduct && <ViewInventoryProductModal product={selectedProduct} token={token} onClose={() => setSelectedProduct(null)} />}
      </div>
    </div>
  );
}

const EMPTY_FORM: SupplierFormState = {
  name: "",
  contactPerson: "",
  telephone: "",
  address: "",
  fax: "",
  email: "",
  vatRegistrationNo: "",
};

export default function SupplierManagementPage() {
  const { token } = useAdmin();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const base = `${API_URL}/api/pos/bike-management`;
  const authHeader = { Authorization: `Bearer ${token}` };

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${base}/suppliers`, { headers: authHeader });
      const payload = await response.json() as { data?: Supplier[]; message?: string };
      if (!response.ok) {
        setError(payload.message === "Route not found" ? "Supplier API route is not live yet. Restart the backend server and reload this page." : payload.message ?? "Failed to load suppliers");
        return;
      }
      setSuppliers(payload.data ?? []);
    } catch {
      setError("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const resetSupplierForm = () => {
    setEditingSupplierId(null);
    setSupplierForm(EMPTY_FORM);
  };

  const populateSupplierForm = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setSupplierForm({
      name: supplier.name ?? "",
      contactPerson: supplier.contactPerson ?? "",
      telephone: supplier.telephone ?? "",
      address: supplier.address ?? "",
      fax: supplier.fax ?? "",
      email: supplier.email ?? "",
      vatRegistrationNo: supplier.vatRegistrationNo ?? "",
    });
  };

  const setField = (key: keyof SupplierFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setSupplierForm((current) => ({ ...current, [key]: value }));
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const method = editingSupplierId ? "PATCH" : "POST";
      const url = editingSupplierId ? `${base}/suppliers/${editingSupplierId}` : `${base}/suppliers`;
      const response = await fetch(url, {
        method,
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: supplierForm.name.trim(),
          contactPerson: supplierForm.contactPerson,
          telephone: supplierForm.telephone,
          address: supplierForm.address,
          fax: supplierForm.fax,
          email: supplierForm.email,
          vatRegistrationNo: supplierForm.vatRegistrationNo,
        }),
      });
      const payload = await response.json() as { data?: Supplier; message?: string };
      if (!response.ok || !payload.data) {
        setError(payload.message === "Route not found" ? "Supplier API route is not live yet. Restart the backend server and reload this page." : payload.message ?? "Supplier save failed");
        return;
      }

      const savedSupplier = payload.data;
      setSuppliers((current) => {
        const next = editingSupplierId
          ? current.map((supplier) => supplier.id === savedSupplier.id ? savedSupplier : supplier)
          : [...current, savedSupplier];
        return next.sort((left, right) => left.name.localeCompare(right.name));
      });
      resetSupplierForm();
    } catch {
      setError("Supplier save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    setError(null);
    try {
      const response = await fetch(`${base}/suppliers/${id}`, { method: "DELETE", headers: authHeader });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        setError(payload?.message === "Route not found" ? "Supplier API route is not live yet. Restart the backend server and reload this page." : payload?.message ?? "Delete failed");
        return;
      }
      setSuppliers((current) => current.filter((supplier) => supplier.id !== id));
      if (editingSupplierId === id) resetSupplierForm();
    } catch {
      setError("Delete failed");
    } finally {
      setConfirm(null);
    }
  };

  const linkedProductCount = suppliers.reduce((sum, supplier) => sum + (supplier._count?.products ?? 0), 0);
  const activeContacts = suppliers.filter((supplier) => supplier.contactPerson || supplier.telephone || supplier.email).length;
  const filteredSuppliers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return suppliers;
    return suppliers.filter((supplier) => [supplier.name, supplier.code, supplier.contactPerson, supplier.telephone, supplier.email, supplier.vatRegistrationNo, supplier.address]
      .some((value) => value?.toLowerCase().includes(needle)));
  }, [search, suppliers]);
  const pagedSuppliers = useMemo(() => paginateRows(filteredSuppliers, page, pageSize), [filteredSuppliers, page, pageSize]);
  useEffect(() => { setPage(1); }, [search, pageSize]);

  const exportSuppliersPdf = () => {
    exportTableToPdf({
      fileName: "suppliers-report",
      title: "Suppliers Report",
      subtitle: "All supplier records currently loaded in Supplier Management",
      rows: suppliers,
      columns: [
        { header: "Supplier Name", value: (supplier) => supplier.name },
        { header: "Supplier Code", value: (supplier) => supplier.code },
        { header: "Contact Person", value: (supplier) => supplier.contactPerson ?? "-" },
        { header: "Telephone", value: (supplier) => supplier.telephone ?? "-" },
        { header: "Email", value: (supplier) => supplier.email ?? "-" },
        { header: "Fax", value: (supplier) => supplier.fax ?? "-" },
        { header: "VAT Reg. No", value: (supplier) => supplier.vatRegistrationNo ?? "-" },
        { header: "Address", value: (supplier) => supplier.address ?? "-" },
        { header: "Linked Products", value: (supplier) => supplier._count?.products ?? 0 },
      ],
    });
  };

  return (
    <div className="bm-page">
      <div className="page-title-row">
        <div className="page-title-icon"><IconSupplier /></div>
        <div>
          <h2 className="page-title">Supplier Management</h2>
          <p className="page-subtitle">Register beverage suppliers and review every product they provide.</p>
        </div>
        <button type="button" className="btn-outline" onClick={exportSuppliersPdf}>Export PDF</button>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="bm-stats-grid">
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head">
            <span className="bm-stat-icon"><IconSupplier /></span>
            <span className="bm-stat-label">Suppliers</span>
          </div>
          <strong className="bm-stat-value">{suppliers.length}</strong>
          <span className="bm-stat-sub">Registered supplier records</span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head">
            <span className="bm-stat-icon"><IconInventory /></span>
            <span className="bm-stat-label">Linked Products</span>
          </div>
          <strong className="bm-stat-value">{linkedProductCount}</strong>
          <span className="bm-stat-sub">Catalog items with a supplier</span>
        </div>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head">
            <span className="bm-stat-icon"><IconSupplier /></span>
            <span className="bm-stat-label">With Contact Info</span>
          </div>
          <strong className="bm-stat-value">{activeContacts}</strong>
          <span className="bm-stat-sub">Suppliers ready for follow-up</span>
        </div>
      </div>

      <div className="bm-manage-grid">
        <div className="bm-manage-col">
          <div className="bm-col-header">
            <span className="bm-col-title">Supplier Registration</span>
            {editingSupplierId && <span className="bm-col-count">Editing</span>}
          </div>

          <div className="bm-field-group">
            <label>Supplier Code</label>
            <input className="bm-input" value={editingSupplierId ? suppliers.find((supplier) => supplier.id === editingSupplierId)?.code ?? "" : "Auto generated on save"} disabled />
          </div>
          <div className="bm-field-group">
            <label>Supplier Name *</label>
            <input className="bm-input" value={supplierForm.name} onChange={setField("name")} placeholder="Supplier name" />
          </div>
          <div className="bm-field-group">
            <label>Contact Person</label>
            <input className="bm-input" value={supplierForm.contactPerson} onChange={setField("contactPerson")} placeholder="Contact person" />
          </div>
          <div className="bm-field-group">
            <label>Telephone</label>
            <input className="bm-input" value={supplierForm.telephone} onChange={setField("telephone")} placeholder="Telephone" />
          </div>
          <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
            <label>Address</label>
            <textarea className="bm-input" rows={3} value={supplierForm.address} onChange={setField("address")} placeholder="Address" />
          </div>
          <div className="bm-field-group">
            <label>Fax</label>
            <input className="bm-input" value={supplierForm.fax} onChange={setField("fax")} placeholder="Fax" />
          </div>
          <div className="bm-field-group">
            <label>Email</label>
            <input className="bm-input" type="email" value={supplierForm.email} onChange={setField("email")} placeholder="Email" />
          </div>
          <div className="bm-field-group">
            <label>VAT Registration No</label>
            <input className="bm-input" value={supplierForm.vatRegistrationNo} onChange={setField("vatRegistrationNo")} placeholder="VAT registration no" />
          </div>

          <div className="bm-modal-actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="btn-accent" onClick={handleSaveSupplier} disabled={saving || !supplierForm.name.trim()}>{saving ? "Saving..." : editingSupplierId ? "Update Supplier" : "Save Supplier"}</button>
            {editingSupplierId && <button type="button" className="btn-outline" onClick={resetSupplierForm}>Cancel</button>}
          </div>
        </div>

        <div className="bm-manage-col">
          <div className="bm-col-header">
            <span className="bm-col-title">Suppliers</span>
            <span className="bm-col-count">{filteredSuppliers.length}</span>
          </div>

          <input className="bm-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier, code, contact or VAT number" />

          {loading && <p className="bm-empty">Loading...</p>}
          {!loading && suppliers.length === 0 && <p className="bm-empty">No suppliers yet.</p>}

          <div className="bm-list">
            {pagedSuppliers.map((supplier) => (
              <div key={supplier.id} className="bm-list-item">
                <div className="bm-item-name-btn">
                  <span className="bm-item-name">{supplier.name}</span>
                  <span className="bm-item-meta">{supplier.code} · {supplier._count?.products ?? 0} products</span>
                  <span className="bm-item-meta">{supplier.contactPerson || supplier.telephone || supplier.email || "No contact details"}</span>
                </div>
                <div className="bm-actions">
                  <button type="button" className="bm-action-btn bm-view-btn" onClick={() => setViewSupplier(supplier)} title="View">View</button>
                  <button type="button" className="bm-action-btn bm-edit-btn" onClick={() => populateSupplierForm(supplier)} title="Edit">✎</button>
                  <button type="button" className="bm-action-btn bm-del-btn" onClick={() => setConfirm({ id: supplier.id, name: supplier.name })} title="Delete">🗑</button>
                </div>
              </div>
            ))}
          </div>
          <TablePagination page={page} pageSize={pageSize} total={filteredSuppliers.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      </div>

      {viewSupplier && <ViewSupplierModal supplier={viewSupplier} token={token} onClose={() => setViewSupplier(null)} />}

      {confirm && (
        <div className="bm-modal-backdrop" onClick={() => setConfirm(null)}>
          <div className="bm-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="bm-modal-title">Confirm Delete</h3>
            <p className="bm-modal-body">Delete supplier <strong>{confirm.name}</strong>? Linked products will keep their records and lose only the supplier reference.</p>
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="bm-btn-danger" onClick={() => handleDeleteSupplier(confirm.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
