"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { IconPreOrders, IconActivity, IconInventory } from "../../lib/icons";
import CustomerPurchaseModal from "../../components/CustomerPurchaseModal";

// â"€â"€ Types â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
type PreOrderImage = {
  id: number;
  preOrderId: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
};

type PreOrder = {
  id: number;
  displayId: string;
  brand: string;
  model: string;
  year?: number | null;
  cc?: string | null;
  colour?: string | null;
  price?: number | null;
  depositRequired?: string | null;
  expectedArrival?: string | null;
  status: string;
  description?: string | null;
  pdfUrl?: string | null;
  isPublished: boolean;
  sortOrder: number;
  images: PreOrderImage[];
  createdAt: string;
  updatedAt: string;
};

type Brand = { id: number; name: string };
type Model = { id: number; name: string; brandId: number };

const MAX_IMAGE_COUNT = 6;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function resolveAssetUrl(assetPath?: string | null) {
  if (!assetPath) return null;
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  return `${API_URL.replace(/\/$/, "")}${assetPath.startsWith("/") ? "" : "/"}${assetPath}`;
}

function getPrimaryImageSrc(images: PreOrderImage[]): string | null {
  if (!images?.length) return null;
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return resolveAssetUrl(primary.url);
}

// â"€â"€ Main Component â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
export default function PreOrdersManagementPage() {
  const { token } = useAdmin();
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPreOrder, setEditingPreOrder] = useState<PreOrder | null>(null);
  const [viewPreOrder, setViewPreOrder] = useState<PreOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PreOrder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sellTarget, setSellTarget] = useState<PreOrder | null>(null);

  // Form state
  const emptyForm = {
    brandId: "",
    brand: "",
    modelId: "",
    model: "",
    year: "",
    cc: "",
    colour: "",
    price: "",
    depositRequired: "",
    expectedArrival: "",
    status: "pre-order",
    description: "",
    isPublished: true,
    sortOrder: "0",
  };
  const [form, setForm] = useState(emptyForm);

  // Image state
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);

  // PDF state
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [showNewModel, setShowNewModel] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newModelName, setNewModelName] = useState("");

  // â"€â"€ Fetch â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const bikeManagementBase = `${API_URL}/api/pos/bike-management`;

  const fetchBrands = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${bikeManagementBase}/brands`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load brands");
      const payload = (await res.json()) as { data?: Brand[] };
      setBrands((payload.data ?? []).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      // Keep pre-orders working even if brand list temporarily fails.
      setBrands([]);
    }
  }, [bikeManagementBase, token]);

  const fetchModelsByBrand = useCallback(
    async (brandId: string) => {
      if (!token || !brandId) {
        setModels([]);
        return;
      }
      try {
        const res = await fetch(`${bikeManagementBase}/brands/${brandId}/models`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load models");
        const payload = (await res.json()) as { data?: Model[] };
        setModels((payload.data ?? []).sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        setModels([]);
      }
    },
    [bikeManagementBase, token],
  );

  const fetchPreOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res = await fetch(`${API_URL}/api/pos/pre-orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load pre-orders");
      const data = await res.json();
      setPreOrders(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading pre-orders");
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, page]);

  useEffect(() => {
    fetchPreOrders();
  }, [fetchPreOrders]);

  useEffect(() => {
    void fetchBrands();
  }, [fetchBrands]);

  useEffect(() => {
    void fetchModelsByBrand(form.brandId);
  }, [fetchModelsByBrand, form.brandId]);

  useEffect(() => {
    if (!showModal || !form.brand || form.brandId || brands.length === 0) return;
    const matchedBrand = brands.find(
      (brand) => brand.name.toLowerCase() === form.brand.toLowerCase(),
    );
    if (!matchedBrand) return;
    setForm((prev) => ({ ...prev, brandId: String(matchedBrand.id) }));
  }, [showModal, form.brand, form.brandId, brands]);

  useEffect(() => {
    if (!showModal || !form.model || form.modelId || models.length === 0) return;
    const matchedModel = models.find(
      (model) => model.name.toLowerCase() === form.model.toLowerCase(),
    );
    if (!matchedModel) return;
    setForm((prev) => ({ ...prev, modelId: String(matchedModel.id) }));
  }, [showModal, form.model, form.modelId, models]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const addBrand = async () => {
    if (!token || !newBrandName.trim()) return;
    try {
      const res = await fetch(`${bikeManagementBase}/brands`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newBrandName.trim() }),
      });
      const payload = (await res.json()) as { data?: Brand; message?: string };
      if (!res.ok || !payload.data) {
        throw new Error(payload.message ?? "Failed to add brand");
      }
      setBrands((current) => [...current, payload.data!].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => ({
        ...prev,
        brandId: String(payload.data!.id),
        brand: payload.data!.name,
        modelId: "",
        model: "",
      }));
      setNewBrandName("");
      setShowNewBrand(false);
      setShowNewModel(false);
      setModels([]);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to add brand");
    }
  };

  const addModel = async () => {
    if (!token || !form.brandId || !newModelName.trim()) return;
    try {
      const res = await fetch(`${bikeManagementBase}/brands/${form.brandId}/models`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newModelName.trim() }),
      });
      const payload = (await res.json()) as { data?: Model; message?: string };
      if (!res.ok || !payload.data) {
        throw new Error(payload.message ?? "Failed to add model");
      }
      setModels((current) => [...current, payload.data!].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => ({
        ...prev,
        modelId: String(payload.data!.id),
        model: payload.data!.name,
      }));
      setNewModelName("");
      setShowNewModel(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to add model");
    }
  };

  // â"€â"€ Open modals â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  function openAdd() {
    setEditingPreOrder(null);
    setForm(emptyForm);
    setPendingImages([]);
    setImageError(null);
    setPendingPdf(null);
    setPdfError(null);
    setModalError(null);
    setShowNewBrand(false);
    setShowNewModel(false);
    setNewBrandName("");
    setNewModelName("");
    setShowModal(true);
  }

  function openEdit(po: PreOrder) {
    setEditingPreOrder(po);
    setForm({
      brand: po.brand,
      brandId: "",
      model: po.model,
      modelId: "",
      year: po.year != null ? String(po.year) : "",
      cc: po.cc ?? "",
      colour: po.colour ?? "",
      price: po.price != null ? String(po.price) : "",
      depositRequired: po.depositRequired ?? "",
      expectedArrival: po.expectedArrival ?? "",
      status: po.status,
      description: po.description ?? "",
      isPublished: po.isPublished,
      sortOrder: String(po.sortOrder),
    });
    setPendingImages([]);
    setImageError(null);
    setPendingPdf(null);
    setPdfError(null);
    setModalError(null);
    setShowNewBrand(false);
    setShowNewModel(false);
    setNewBrandName("");
    setNewModelName("");
    setShowModal(true);
  }

  // â"€â"€ Image selection â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setImageError(null);
    const files = Array.from(e.target.files ?? []);
    const existingCount = editingPreOrder?.images?.length ?? 0;
    const allowed = MAX_IMAGE_COUNT - existingCount - pendingImages.length;
    if (files.length > allowed) {
      setImageError(`You can add at most ${allowed} more image(s).`);
      return;
    }
    for (const f of files) {
      if (f.size > MAX_IMAGE_SIZE_BYTES) {
        setImageError(`${f.name} exceeds 10 MB limit.`);
        return;
      }
    }
    setPendingImages((prev) => [...prev, ...files]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function removePendingImage(idx: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function deleteExistingImage(poId: number, imageId: number) {
    try {
      const res = await fetch(
        `${API_URL}/api/pos/pre-orders/${poId}/images/${imageId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to delete image");
      setEditingPreOrder((prev) =>
        prev
          ? { ...prev, images: prev.images.filter((i) => i.id !== imageId) }
          : prev,
      );
    } catch {
      setModalError("Failed to delete image");
    }
  }

  async function setPrimaryImage(poId: number, imageId: number) {
    try {
      const res = await fetch(
        `${API_URL}/api/pos/pre-orders/${poId}/images/${imageId}/primary`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to set primary");
      setEditingPreOrder((prev) =>
        prev
          ? {
              ...prev,
              images: prev.images.map((i) => ({
                ...i,
                isPrimary: i.id === imageId,
              })),
            }
          : prev,
      );
    } catch {
      setModalError("Failed to set primary image");
    }
  }

  // â"€â"€ Submit â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      const body: Record<string, unknown> = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        ...(form.year ? { year: parseInt(form.year) } : {}),
        ...(form.cc ? { cc: form.cc.trim() } : {}),
        ...(form.colour ? { colour: form.colour.trim() } : {}),
        ...(form.price ? { price: parseFloat(form.price) } : {}),
        ...(form.depositRequired
          ? { depositRequired: form.depositRequired.trim() }
          : {}),
        ...(form.expectedArrival
          ? { expectedArrival: form.expectedArrival.trim() }
          : {}),
        status: form.status,
        ...(form.description ? { description: form.description.trim() } : {}),
        isPublished: form.isPublished,
        sortOrder: parseInt(form.sortOrder) || 0,
      };

      const method = editingPreOrder ? "PATCH" : "POST";
      const url = editingPreOrder
        ? `${API_URL}/api/pos/pre-orders/${editingPreOrder.id}`
        : `${API_URL}/api/pos/pre-orders`;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message ?? "Failed to save",
        );
      }

      const saved: PreOrder = await res.json();

      if (pendingImages.length > 0) {
        setUploadingImages(true);
        for (const file of pendingImages) {
          const fd = new FormData();
          fd.append("image", file);
          await fetch(`${API_URL}/api/pos/pre-orders/${saved.id}/images`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
        }
        setUploadingImages(false);
      }

      if (pendingPdf) {
        const fd = new FormData();
        fd.append("pdf", pendingPdf);
        const pdfRes = await fetch(`${API_URL}/api/pos/pre-orders/${saved.id}/pdf`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!pdfRes.ok) {
          const errData = await pdfRes.json().catch(() => ({}));
          throw new Error(
            (errData as { message?: string }).message ?? "Failed to upload PDF brochure",
          );
        }
      }

      setPendingImages([]);
      setPendingPdf(null);
      setShowModal(false);
      await fetchPreOrders();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
      setUploadingImages(false);
    }
  }

  // â"€â"€ Delete â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `${API_URL}/api/pos/pre-orders/${deleteConfirm.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to delete");
      setDeleteConfirm(null);
      await fetchPreOrders();
    } catch {
      setError("Failed to delete pre-order");
    } finally {
      setDeleting(false);
    }
  }

  // â"€â"€ Stats â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const totalPreOrder = preOrders.filter(
    (p) => p.status === "pre-order",
  ).length;
  const totalInStock = preOrders.filter((p) => p.status === "in-stock").length;
  const totalPublished = preOrders.filter((p) => p.isPublished).length;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="bm-page">
      {/* Header */}
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon">
            <IconPreOrders />
          </div>
          <div>
            <h2 className="page-title">Pre Orders Management</h2>
            <p className="page-subtitle">
              Manage upcoming drink arrivals and purchase-order listings shown on the
              public website.
            </p>
          </div>
        </div>
        <button type="button" className="btn-accent" onClick={openAdd}>
          + Add Pre Order
        </button>
      </div>

      {/* Stats */}
      <div className="bm-stats-grid">
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head">
            <span className="bm-stat-icon">
              <IconPreOrders />
            </span>
            <span className="bm-stat-label">Pre Orders</span>
          </div>
          <strong className="bm-stat-value">{totalPreOrder}</strong>
          <span className="bm-stat-sub">Awaiting arrival</span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head">
            <span className="bm-stat-icon">
              <IconInventory />
            </span>
            <span className="bm-stat-label">In Stock</span>
          </div>
          <strong className="bm-stat-value">{totalInStock}</strong>
          <span className="bm-stat-sub">Available now</span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head">
            <span className="bm-stat-icon">
              <IconActivity />
            </span>
            <span className="bm-stat-label">Published</span>
          </div>
          <strong className="bm-stat-value">{totalPublished}</strong>
          <span className="bm-stat-sub">Visible on website</span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head">
            <span className="bm-stat-icon">
              <IconActivity />
            </span>
            <span className="bm-stat-label">Total</span>
          </div>
          <strong className="bm-stat-value">{total}</strong>
          <span className="bm-stat-sub">All pre-orders</span>
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      {/* Table card */}
      <div className="bm-table-card">
        {/* Toolbar */}
        <div
          style={{
            padding: "1rem",
            borderBottom: "1px solid var(--panel-border)",
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            className="bm-input"
            style={{ maxWidth: 360 }}
            placeholder="Search by brand, model, colourâ€¦"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="bm-input"
            style={{ maxWidth: 200 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pre-order">Pre Order</option>
            <option value="in-stock">In Stock</option>
          </select>
          <button
            type="button"
            className="btn-outline"
            onClick={() => void fetchPreOrders()}
          >
            Refresh
          </button>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 64 }}>Image</th>
                <th>ID</th>
                <th>Product</th>
                <th>Year / CC</th>
                <th>Price</th>
                <th>Status</th>
                <th>Published</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="bm-table-empty">
                    Loadingâ€¦
                  </td>
                </tr>
              ) : preOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="bm-table-empty">
                    No pre-orders found.
                  </td>
                </tr>
              ) : (
                preOrders.map((po) => {
                  const imgSrc = getPrimaryImageSrc(po.images);
                  return (
                    <tr key={po.id}>
                      <td>
                        {imgSrc ? (
                          <Image
                            src={imgSrc}
                            alt={`${po.brand} ${po.model}`}
                            width={56}
                            height={44}
                            style={{
                              objectFit: "cover",
                              borderRadius: 6,
                              background: "#f5f5f5",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 56,
                              height: 44,
                              background: "var(--bg)",
                              borderRadius: 6,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--text-soft)",
                              fontSize: 10,
                            }}
                          >
                            No img
                          </div>
                        )}
                      </td>
                      <td>
                        <code style={{ fontSize: 11 }}>{po.displayId}</code>
                      </td>
                      <td>
                        <strong>
                          {po.brand} {po.model}
                        </strong>
                        {po.colour && (
                          <div
                            style={{ fontSize: 11, color: "var(--text-soft)" }}
                          >
                            {po.colour}
                          </div>
                        )}
                      </td>
                      <td>
                        {po.year && (
                          <div style={{ fontSize: 12 }}>{po.year}</div>
                        )}
                        {po.cc && (
                          <div
                            style={{ fontSize: 11, color: "var(--text-soft)" }}
                          >
                            {po.cc}
                          </div>
                        )}
                      </td>
                      <td>
                        {po.price != null
                          ? `Rs. ${po.price.toLocaleString("en-LK")}`
                          : "-"}
                      </td>
                      <td>
                        <span
                          className={`badge ${po.status === "in-stock" ? "badge-active" : "badge-warning"}`}
                        >
                          {po.status === "in-stock" ? "In Stock" : "Pre Order"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${po.isPublished ? "badge-active" : "badge-pending"}`}
                        >
                          {po.isPublished ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>
                        <div className="bm-actions">
                          <button
                            type="button"
                            className="bm-action-btn bm-view-btn"
                            title="View"
                            onClick={() => setViewPreOrder(po)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="bm-action-btn bm-edit-btn"
                            title="Edit"
                            onClick={() => openEdit(po)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="bm-action-btn btn-accent"
                            title="Sell to Customer"
                            onClick={() => setSellTarget(po)}
                          >
                            Sell
                          </button>
                          <button
                            type="button"
                            className="bm-action-btn bm-del-btn"
                            title="Delete"
                            onClick={() => setDeleteConfirm(po)}
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              padding: "1rem",
              borderTop: "1px solid var(--panel-border)",
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              className="btn-outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              â† Prev
            </button>
            <span style={{ fontSize: 13, color: "var(--text-soft)" }}>
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn-outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next â†'
            </button>
          </div>
        )}
      </div>

      {/* â"€â"€ Add/Edit Modal â"€â"€ */}
      {showModal && (
        <div className="bm-modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="bm-modal bm-view-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="bm-modal-close"
              onClick={() => setShowModal(false)}
            >
              ×
            </button>
            <h3 className="bm-modal-title">
              {editingPreOrder
                ? `Edit Pre Order â€" ${editingPreOrder.displayId}`
                : "Add Pre Order"}
            </h3>
            {modalError && (
              <div className="bm-alert bm-alert-error">{modalError}</div>
            )}

            <form className="bm-modal-form" onSubmit={handleSubmit}>
              <div className="bm-fields-grid">
                <div className="bm-field-group">
                  <label>Brand *</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      className="bm-input"
                      value={form.brandId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const selectedBrand = brands.find((brand) => String(brand.id) === selectedId);
                        setForm((prev) => ({
                          ...prev,
                          brandId: selectedId,
                          brand: selectedBrand?.name ?? "",
                          modelId: "",
                          model: "",
                        }));
                        setShowNewModel(false);
                      }}
                      required
                    >
                      <option value="">— Select Brand —</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={String(brand.id)}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setShowNewBrand((current) => !current)}
                    >
                      + Add
                    </button>
                  </div>
                  {showNewBrand && (
                    <div className="bm-quick-add-row">
                      <input
                        className="bm-input bm-input-sm"
                        placeholder="New brand..."
                        value={newBrandName}
                        onChange={(e) => setNewBrandName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void addBrand();
                          }
                          if (e.key === "Escape") setShowNewBrand(false);
                        }}
                        autoFocus
                      />
                      <button type="button" className="btn-accent bm-add-btn" onClick={() => void addBrand()}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="bm-action-btn bm-cancel-btn"
                        onClick={() => setShowNewBrand(false)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <div className="bm-field-group">
                  <label>Model *</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      className="bm-input"
                      value={form.modelId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const selectedModel = models.find((model) => String(model.id) === selectedId);
                        setForm((prev) => ({
                          ...prev,
                          modelId: selectedId,
                          model: selectedModel?.name ?? "",
                        }));
                      }}
                      required
                      disabled={!form.brandId}
                    >
                      <option value="">— Select Model —</option>
                      {models.map((model) => (
                        <option key={model.id} value={String(model.id)}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={!form.brandId}
                      onClick={() => setShowNewModel((current) => !current)}
                    >
                      + Add
                    </button>
                  </div>
                  {showNewModel && (
                    <div className="bm-quick-add-row">
                      <input
                        className="bm-input bm-input-sm"
                        placeholder="New model..."
                        value={newModelName}
                        onChange={(e) => setNewModelName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void addModel();
                          }
                          if (e.key === "Escape") setShowNewModel(false);
                        }}
                        autoFocus
                      />
                      <button type="button" className="btn-accent bm-add-btn" onClick={() => void addModel()}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="bm-action-btn bm-cancel-btn"
                        onClick={() => setShowNewModel(false)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <div className="bm-field-group">
                  <label>Year</label>
                  <input
                    className="bm-input"
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    placeholder="e.g. 2026"
                    min={1900}
                    max={2100}
                  />
                </div>
                <div className="bm-field-group">
                  <label>Engine CC</label>
                  <input
                    className="bm-input"
                    value={form.cc}
                    onChange={(e) => setForm({ ...form, cc: e.target.value })}
                    placeholder="e.g. 155cc"
                  />
                </div>
                <div className="bm-field-group">
                  <label>Colour</label>
                  <input
                    className="bm-input"
                    value={form.colour}
                    onChange={(e) =>
                      setForm({ ...form, colour: e.target.value })
                    }
                    placeholder="e.g. Metallic Black"
                  />
                </div>
                <div className="bm-field-group">
                  <label>Price (Rs.)</label>
                  <input
                    className="bm-input"
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    placeholder="e.g. 1250000"
                    min={0}
                  />
                </div>
                <div className="bm-field-group">
                  <label>Deposit Required</label>
                  <input
                    className="bm-input"
                    value={form.depositRequired}
                    onChange={(e) =>
                      setForm({ ...form, depositRequired: e.target.value })
                    }
                    placeholder="e.g. Rs. 150,000"
                  />
                </div>
                <div className="bm-field-group">
                  <label>Expected Arrival</label>
                  <input
                    className="bm-input"
                    value={form.expectedArrival}
                    onChange={(e) =>
                      setForm({ ...form, expectedArrival: e.target.value })
                    }
                    placeholder="e.g. April 2026"
                  />
                </div>
                <div className="bm-field-group">
                  <label>Status</label>
                  <select
                    className="bm-input"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    <option value="pre-order">Pre Order</option>
                    <option value="in-stock">In Stock</option>
                  </select>
                </div>
                <div className="bm-field-group">
                  <label>Sort Order</label>
                  <input
                    className="bm-input"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm({ ...form, sortOrder: e.target.value })
                    }
                    placeholder="0"
                    min={0}
                  />
                </div>
                <div
                  className="bm-field-group"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <label>Description</label>
                  <textarea
                    className="bm-input"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="Describe this bikeâ€¦"
                    rows={3}
                    style={{ resize: "vertical" }}
                  />
                </div>
                <div
                  className="bm-field-group"
                  style={{
                    gridColumn: "1 / -1",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <input
                    type="checkbox"
                    id="po-published"
                    checked={form.isPublished}
                    onChange={(e) =>
                      setForm({ ...form, isPublished: e.target.checked })
                    }
                    style={{ width: 16, height: 16, flexShrink: 0 }}
                  />
                  <label
                    htmlFor="po-published"
                    style={{ marginBottom: 0, cursor: "pointer" }}
                  >
                    Published (visible on website)
                  </label>
                </div>
              </div>

              {/* Images */}
              <div className="bm-field-group" style={{ marginTop: "0.5rem" }}>
                <label>Images</label>
                {imageError && (
                  <div
                    className="bm-alert bm-alert-error"
                    style={{ marginBottom: 8 }}
                  >
                    {imageError}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 8,
                  }}
                >
                  {/* Existing images */}
                  {editingPreOrder?.images.map((img) => (
                    <div
                      key={img.id}
                      style={{
                        position: "relative",
                        border: img.isPrimary
                          ? "2px solid var(--accent)"
                          : "1px solid var(--panel-border)",
                        borderRadius: 6,
                        overflow: "hidden",
                        cursor: "pointer",
                      }}
                      title={
                        img.isPrimary
                          ? "Primary image"
                          : "Click to set as primary"
                      }
                      onClick={() =>
                        !img.isPrimary &&
                        setPrimaryImage(editingPreOrder.id, img.id)
                      }
                    >
                      <Image
                        src={resolveAssetUrl(img.url) ?? ""}
                        alt="img"
                        width={72}
                        height={56}
                        style={{ objectFit: "cover", display: "block" }}
                      />
                      {img.isPrimary && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 2,
                            left: 2,
                            background: "var(--accent)",
                            color: "#fff",
                            fontSize: 9,
                            padding: "1px 4px",
                            borderRadius: 3,
                          }}
                        >
                          â˜…
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteExistingImage(editingPreOrder.id, img.id);
                        }}
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          background: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "50%",
                          width: 18,
                          height: 18,
                          cursor: "pointer",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                        }}
                      >
                        Ã—
                      </button>
                    </div>
                  ))}
                  {/* Pending images */}
                  {pendingImages.map((f, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: "relative",
                        border: "1px dashed var(--panel-border)",
                        borderRadius: 6,
                        overflow: "hidden",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        style={{
                          width: 72,
                          height: 56,
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removePendingImage(idx)}
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          background: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "50%",
                          width: 18,
                          height: 18,
                          cursor: "pointer",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                        }}
                      >
                        Ã—
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  onChange={handleImageSelect}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={
                    (editingPreOrder?.images?.length ?? 0) +
                      pendingImages.length >=
                    MAX_IMAGE_COUNT
                  }
                >
                  + Add Images
                </button>
              </div>

              {/* PDF Brochure */}
              <div className="bm-field-group" style={{ marginTop: "0.5rem" }}>
                <label>Brochure PDF</label>
                {pdfError && (
                  <div className="bm-alert bm-alert-error" style={{ marginBottom: 8 }}>
                    {pdfError}
                  </div>
                )}
                {editingPreOrder?.pdfUrl && !pendingPdf && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <a
                      href={resolveAssetUrl(editingPreOrder.pdfUrl) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "var(--accent)", textDecoration: "underline" }}
                    >
                      View current PDF
                    </a>
                    <span style={{ fontSize: 11, color: "var(--text-soft)" }}>(upload new to replace)</span>
                  </div>
                )}
                {pendingPdf && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text)" }}>{pendingPdf.name}</span>
                    <button
                      type="button"
                      onClick={() => { setPendingPdf(null); if (pdfInputRef.current) pdfInputRef.current.value = ""; }}
                      style={{ fontSize: 11, color: "var(--text-soft)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                )}
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    setPdfError(null);
                    const file = e.target.files?.[0] ?? null;
                    if (file && file.size > 20 * 1024 * 1024) {
                      setPdfError("PDF exceeds 20 MB limit.");
                      return;
                    }
                    setPendingPdf(file);
                  }}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => pdfInputRef.current?.click()}
                >
                  {pendingPdf ? "Change PDF" : "Upload PDF"}
                </button>
              </div>

              <div className="bm-modal-actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-accent"
                  disabled={saving || uploadingImages}
                >
                  {uploadingImages
                    ? "Uploading images…"
                    : saving
                      ? "Saving…"
                      : editingPreOrder
                        ? "Save Changes"
                        : "Add Pre Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â"€â"€ View Modal â"€â"€ */}
      {viewPreOrder && (
        <div
          className="bm-modal-backdrop"
          onClick={() => setViewPreOrder(null)}
        >
          <div
            className="bm-modal bm-view-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="bm-modal-close"
              onClick={() => setViewPreOrder(null)}
            >
              ×
            </button>
            <h3 className="bm-modal-title">
              {viewPreOrder.brand} {viewPreOrder.model} â€"{" "}
              <code style={{ fontSize: 13 }}>{viewPreOrder.displayId}</code>
            </h3>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {viewPreOrder.images.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {viewPreOrder.images.map((img) => (
                    <div
                      key={img.id}
                      style={{
                        border: img.isPrimary
                          ? "2px solid var(--accent)"
                          : "1px solid var(--panel-border)",
                        borderRadius: 6,
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        src={`${API_URL}${img.url}`}
                        alt="img"
                        width={100}
                        height={78}
                        style={{ objectFit: "cover", display: "block" }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.5rem 1.5rem",
                }}
              >
                {[
                  [
                    "ID",
                    <code key="id" style={{ fontSize: 12 }}>
                      {viewPreOrder.displayId}
                    </code>,
                  ],
                  ["Brand", viewPreOrder.brand],
                  ["Model", viewPreOrder.model],
                  viewPreOrder.year
                    ? ["Year", String(viewPreOrder.year)]
                    : null,
                  viewPreOrder.cc ? ["Engine", viewPreOrder.cc] : null,
                  viewPreOrder.colour ? ["Colour", viewPreOrder.colour] : null,
                  viewPreOrder.price != null
                    ? [
                        "Price",
                        `Rs. ${viewPreOrder.price.toLocaleString("en-LK")}`,
                      ]
                    : null,
                  viewPreOrder.depositRequired
                    ? ["Deposit", viewPreOrder.depositRequired]
                    : null,
                  viewPreOrder.expectedArrival
                    ? ["Expected Arrival", viewPreOrder.expectedArrival]
                    : null,
                  [
                    "Status",
                    <span
                      key="s"
                      className={`badge ${viewPreOrder.status === "in-stock" ? "badge-active" : "badge-warning"}`}
                    >
                      {viewPreOrder.status === "in-stock"
                        ? "In Stock"
                        : "Pre Order"}
                    </span>,
                  ],
                  [
                    "Published",
                    <span
                      key="p"
                      className={`badge ${viewPreOrder.isPublished ? "badge-active" : "badge-pending"}`}
                    >
                      {viewPreOrder.isPublished ? "Yes" : "No"}
                    </span>,
                  ],
                ]
                  .filter(Boolean)
                  .map((row) => {
                    const [label, value] = row as [string, React.ReactNode];
                    return (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text-soft)",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {label}
                        </span>
                        <span style={{ fontSize: 13, color: "var(--text)" }}>
                          {value}
                        </span>
                      </div>
                    );
                  })}
                {viewPreOrder.description && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-soft)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Description
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>
                      {viewPreOrder.description}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bm-modal-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setViewPreOrder(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-accent"
                onClick={() => {
                  setViewPreOrder(null);
                  openEdit(viewPreOrder);
                }}
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sell to Customer */}
      {sellTarget && (
        <CustomerPurchaseModal
          token={token}
          itemType="PRE_ORDER"
          itemId={sellTarget.id}
          itemLabel={`${sellTarget.brand} ${sellTarget.model}${sellTarget.colour ? ` - ${sellTarget.colour}` : ""}`}
          currentSellingPrice={sellTarget.price ?? null}
          onClose={() => setSellTarget(null)}
          onSaved={() => setSellTarget(null)}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div
          className="bm-modal-backdrop"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="bm-modal-title">Confirm Delete</h3>
            <p className="bm-modal-body">
              Delete{" "}
              <strong>
                {deleteConfirm.brand} {deleteConfirm.model}
              </strong>{" "}
              ({deleteConfirm.displayId})? This action cannot be undone.
            </p>
            <div className="bm-modal-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bm-btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deletingâ€¦" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
