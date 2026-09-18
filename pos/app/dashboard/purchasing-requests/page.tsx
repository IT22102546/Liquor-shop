"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { exportTableToPdf } from "../../lib/pdf-export";
import {
  IconPreOrders,
  IconContactRequests,
  IconEdit,
  IconPlus,
  IconClose,
  IconInventory,
  IconActivity,
  IconInvoice,
  IconUsers,
} from "../../lib/icons";

// ──────────────────── TYPES ────────────────────────

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
  isPublished: boolean;
  sortOrder: number;
  images: PreOrderImage[];
  pdfUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Brand = { id: number; name: string };
type Model = { id: number; name: string; brandId: number };

type ContactStatus = "new" | "contacted" | "closed";

interface ContactRequest {
  id: number;
  displayId: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  interests: string;
  message: string | null;
  status: ContactStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StatsData {
  total: number;
  new: number;
  contacted: number;
  closed: number;
}

interface ListResult {
  data: ContactRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const MAX_IMAGE_COUNT = 6;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const PREORDER_LIMIT = 20;

function resolveAssetUrl(assetPath?: string | null) {
  if (!assetPath) return null;
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  return `${API_URL.replace(/\/$/, "")}${assetPath.startsWith("/") ? "" : "/"}${assetPath}`;
}

// ──────────────────── HELPERS ────────────────────────

function getPrimaryImageSrc(images: PreOrderImage[]): string | null {
  if (!images?.length) return null;
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return resolveAssetUrl(primary.url);
}

function statusBadgeClass(status: ContactStatus) {
  if (status === "new") return "badge badge-new";
  if (status === "contacted") return "badge badge-contacted";
  return "badge badge-closed";
}

function statusLabel(status: ContactStatus) {
  if (status === "new") return "New";
  if (status === "contacted") return "Contacted";
  return "Closed";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateRangeLabel(from: string, to: string) {
  if (from && to) return `${from} to ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Up to ${to}`;
  return "All created dates";
}

// ──────────────────── MAIN COMPONENT ────────────────────────

export default function PreOrdersRequestsPage() {
  const { token } = useAdmin();

  // ── Tab state
  const [activeTab, setActiveTab] = useState<"pre-orders" | "contact-requests">(
    "pre-orders",
  );

  // ── Pre-orders state
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [total, setTotal] = useState(0);
  const [preOrderLoading, setPreOrderLoading] = useState(true);
  const [preOrderError, setPreOrderError] = useState<string | null>(null);
  const [preOrderSearch, setPreOrderSearch] = useState("");
  const [preOrderStatusFilter, setPreOrderStatusFilter] = useState("");
  const [preOrderDateFrom, setPreOrderDateFrom] = useState("");
  const [preOrderDateTo, setPreOrderDateTo] = useState("");
  const [preOrderPage, setPreOrderPage] = useState(1);

  const [showPreOrderModal, setShowPreOrderModal] = useState(false);
  const [editingPreOrder, setEditingPreOrder] = useState<PreOrder | null>(null);
  const [viewPreOrder, setViewPreOrder] = useState<PreOrder | null>(null);
  const [preOrderSaving, setPreOrderSaving] = useState(false);
  const [preOrderModalError, setPreOrderModalError] = useState<string | null>(
    null,
  );
  const [preOrderDeleteConfirm, setPreOrderDeleteConfirm] =
    useState<PreOrder | null>(null);
  const [preOrderDeleting, setPreOrderDeleting] = useState(false);

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

  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // ── Contact requests state
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [contactStats, setContactStats] = useState<StatsData | null>(null);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactFilterStatus, setContactFilterStatus] = useState("");
  const [contactPage, setContactPage] = useState(1);
  const [contactTotalPages, setContactTotalPages] = useState(1);

  const [viewContactItem, setViewContactItem] = useState<ContactRequest | null>(
    null,
  );
  const [editContactNotes, setEditContactNotes] = useState("");
  const [editContactStatus, setEditContactStatus] =
    useState<ContactStatus>("new");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactSaveError, setContactSaveError] = useState("");

  const [deleteContactItem, setDeleteContactItem] =
    useState<ContactRequest | null>(null);
  const [contactDeleting, setContactDeleting] = useState(false);

  // ────────────────── PRE-ORDERS FUNCTIONS ──────────────────

  const bikeManagementBase = `${API_URL}/api/pos/bike-management`;

  const fetchBrands = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${bikeManagementBase}/brands`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load brands");
      const payload = (await res.json()) as { data?: Brand[] };
      setBrands(
        (payload.data ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch {
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
        const res = await fetch(
          `${bikeManagementBase}/brands/${brandId}/models`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error("Failed to load models");
        const payload = (await res.json()) as { data?: Model[] };
        setModels(
          (payload.data ?? []).sort((a, b) => a.name.localeCompare(b.name)),
        );
      } catch {
        setModels([]);
      }
    },
    [bikeManagementBase, token],
  );

  const fetchPreOrders = useCallback(async () => {
    if (!token) return;
    setPreOrderLoading(true);
    setPreOrderError(null);
    try {
      const params = new URLSearchParams({
        page: String(preOrderPage),
        limit: String(PREORDER_LIMIT),
        ...(preOrderSearch ? { search: preOrderSearch } : {}),
        ...(preOrderStatusFilter ? { status: preOrderStatusFilter } : {}),
      });
      const res = await fetch(`${API_URL}/api/pos/pre-orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load pre-orders");
      const data = await res.json();
      setPreOrders(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setPreOrderError(
        err instanceof Error ? err.message : "Error loading pre-orders",
      );
    } finally {
      setPreOrderLoading(false);
    }
  }, [token, preOrderSearch, preOrderStatusFilter, preOrderPage]);

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
    if (
      !showPreOrderModal ||
      !form.brand ||
      form.brandId ||
      brands.length === 0
    )
      return;
    const matchedBrand = brands.find(
      (brand) => brand.name.toLowerCase() === form.brand.toLowerCase(),
    );
    if (!matchedBrand) return;
    setForm((prev) => ({ ...prev, brandId: String(matchedBrand.id) }));
  }, [showPreOrderModal, form.brand, form.brandId, brands]);

  useEffect(() => {
    if (
      !showPreOrderModal ||
      !form.model ||
      form.modelId ||
      models.length === 0
    )
      return;
    const matchedModel = models.find(
      (model) => model.name.toLowerCase() === form.model.toLowerCase(),
    );
    if (!matchedModel) return;
    setForm((prev) => ({ ...prev, modelId: String(matchedModel.id) }));
  }, [showPreOrderModal, form.model, form.modelId, models]);

  useEffect(() => {
    setPreOrderPage(1);
  }, [preOrderSearch, preOrderStatusFilter]);

  function closePreOrderModal() {
    setShowPreOrderModal(false);
    setPreOrderModalError(null);
    setImageError(null);
    setPendingImages([]);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setPendingPdf(null);
    setPdfError(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  }

  function openAddPreOrder() {
    setViewPreOrder(null);
    setEditingPreOrder(null);
    setForm(emptyForm);
    setPendingImages([]);
    setImageError(null);
    setPreOrderModalError(null);
    setPendingPdf(null);
    setPdfError(null);
    setShowPreOrderModal(true);
  }

  function openEditPreOrder(po: PreOrder) {
    setViewPreOrder(null);
    setEditingPreOrder(po);
    setForm({
      brandId: "",
      brand: po.brand,
      modelId: "",
      model: po.model,
      year: po.year?.toString() || "",
      cc: po.cc || "",
      colour: po.colour || "",
      price: po.price?.toString() || "",
      depositRequired: po.depositRequired || "",
      expectedArrival: po.expectedArrival || "",
      status: po.status,
      description: po.description || "",
      isPublished: po.isPublished,
      sortOrder: po.sortOrder.toString(),
    });
    setPendingImages([]);
    setImageError(null);
    setPreOrderModalError(null);
    setPendingPdf(null);
    setPdfError(null);
    setShowPreOrderModal(true);
  }

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
      setPreOrderModalError("Failed to delete image");
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
      setPreOrderModalError("Failed to set primary image");
    }
  }

  async function handlePreOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPreOrderSaving(true);
    setPreOrderModalError(null);
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
        await fetch(`${API_URL}/api/pos/pre-orders/${saved.id}/pdf`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      }

      setPendingImages([]);
      setPendingPdf(null);
      setShowPreOrderModal(false);
      await fetchPreOrders();
    } catch (err) {
      setPreOrderModalError(
        err instanceof Error ? err.message : "Error saving",
      );
    } finally {
      setPreOrderSaving(false);
      setUploadingImages(false);
    }
  }

  async function handlePreOrderDelete() {
    if (!preOrderDeleteConfirm) return;
    setPreOrderDeleting(true);
    try {
      const res = await fetch(
        `${API_URL}/api/pos/pre-orders/${preOrderDeleteConfirm.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to delete");
      setPreOrderDeleteConfirm(null);
      await fetchPreOrders();
    } catch {
      setPreOrderError("Failed to delete pre-order");
    } finally {
      setPreOrderDeleting(false);
    }
  }

  // ────────────────── CONTACT REQUESTS FUNCTIONS ──────────────────

  const loadContactStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/pos/contact-requests/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setContactStats(await res.json());
    } catch {}
  }, [token]);

  const loadContactRequests = useCallback(async () => {
    if (!token) {
      setContactLoading(false);
      return;
    }
    setContactLoading(true);
    setContactError("");
    try {
      const params = new URLSearchParams({
        page: String(contactPage),
        limit: "20",
        ...(contactSearch ? { search: contactSearch } : {}),
        ...(contactFilterStatus ? { status: contactFilterStatus } : {}),
      });
      const res = await fetch(`${API_URL}/api/pos/contact-requests?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load contact requests");
      const json: ListResult = await res.json();
      setRequests(json.data);
      setContactTotalPages(json.totalPages || 1);
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setContactLoading(false);
    }
  }, [token, contactPage, contactSearch, contactFilterStatus]);

  useEffect(() => {
    loadContactStats();
    loadContactRequests();
  }, [loadContactStats, loadContactRequests]);

  function openViewContact(item: ContactRequest) {
    setViewContactItem(item);
    setEditContactNotes(item.notes ?? "");
    setEditContactStatus(item.status);
    setContactSaveError("");
  }

  async function handleContactSave() {
    if (!viewContactItem) return;
    setContactSaving(true);
    setContactSaveError("");
    try {
      const res = await fetch(
        `${API_URL}/api/pos/contact-requests/${viewContactItem.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: editContactStatus,
            notes: editContactNotes,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to save");
      const updated: ContactRequest = await res.json();
      setRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      setViewContactItem(null);
      loadContactStats();
    } catch (err) {
      setContactSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setContactSaving(false);
    }
  }

  async function handleContactQuickStatus(
    item: ContactRequest,
    status: ContactStatus,
  ) {
    try {
      const res = await fetch(
        `${API_URL}/api/pos/contact-requests/${item.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      const updated: ContactRequest = await res.json();
      setRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      loadContactStats();
    } catch {}
  }

  async function handleContactDelete() {
    if (!deleteContactItem) return;
    setContactDeleting(true);
    try {
      await fetch(
        `${API_URL}/api/pos/contact-requests/${deleteContactItem.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setRequests((prev) => prev.filter((r) => r.id !== deleteContactItem.id));
      setDeleteContactItem(null);
      loadContactStats();
    } catch {}
    setContactDeleting(false);
  }

  // ────────────────── PRE-ORDER STATS ──────────────────

  const filteredPreOrders = useMemo(() => {
    return preOrders.filter((preOrder) => {
      const createdAt = new Date(preOrder.createdAt).getTime();
      if (Number.isNaN(createdAt)) return false;

      if (preOrderDateFrom) {
        const fromBoundary = new Date(`${preOrderDateFrom}T00:00:00`).getTime();
        if (createdAt < fromBoundary) return false;
      }

      if (preOrderDateTo) {
        const toBoundary = new Date(`${preOrderDateTo}T23:59:59.999`).getTime();
        if (createdAt > toBoundary) return false;
      }

      return true;
    });
  }, [preOrders, preOrderDateFrom, preOrderDateTo]);

  const totalPreOrder = filteredPreOrders.filter(
    (p) => p.status === "pre-order",
  ).length;
  const totalInStock = filteredPreOrders.filter(
    (p) => p.status === "in-stock",
  ).length;
  const totalPublished = filteredPreOrders.filter((p) => p.isPublished).length;
  const totalPreOrderPages = Math.ceil(total / PREORDER_LIMIT);
  const hasPreOrderDateFilter = Boolean(preOrderDateFrom || preOrderDateTo);

  const exportFilteredPreOrdersPdf = useCallback(() => {
    exportTableToPdf({
      fileName: "pre-orders-report",
      title: "Pre Orders Report",
      subtitle: `Created date filter: ${formatDateRangeLabel(preOrderDateFrom, preOrderDateTo)}`,
      rows: filteredPreOrders,
      columns: [
        { header: "Display ID", value: (preOrder) => preOrder.displayId },
        {
          header: "Created Date",
          value: (preOrder) => formatDate(preOrder.createdAt),
        },
        { header: "Brand", value: (preOrder) => preOrder.brand },
        { header: "Model", value: (preOrder) => preOrder.model },
        { header: "Year", value: (preOrder) => preOrder.year ?? "-" },
        {
          header: "Status",
          value: (preOrder) =>
            preOrder.status === "pre-order" ? "Pre-order" : "In Stock",
        },
        {
          header: "Published",
          value: (preOrder) => (preOrder.isPublished ? "Yes" : "No"),
        },
        {
          header: "Price",
          value: (preOrder) =>
            preOrder.price != null ? preOrder.price.toLocaleString() : "-",
        },
      ],
    });
  }, [filteredPreOrders, preOrderDateFrom, preOrderDateTo]);

  return (
    <div className="bm-page">
      {/* ── Tab Navigation ── */}
      <div className="tab-navigation">
        <button
          type="button"
          onClick={() => setActiveTab("pre-orders")}
          className={`tab-button ${activeTab === "pre-orders" ? "active" : ""}`}
        >
          <IconPreOrders />
          Pre-Orders
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("contact-requests")}
          className={`tab-button ${activeTab === "contact-requests" ? "active" : ""}`}
        >
          <IconContactRequests />
          Contact Requests
        </button>
      </div>

      {/* ──────────── PRE-ORDERS TAB ──────────── */}
      {activeTab === "pre-orders" && (
        <>
          {/* Header */}
          <div className="bm-page-header">
            <div className="page-title-row">
              <div className="page-title-icon">
                <IconPreOrders />
              </div>
              <div>
                <h2 className="page-title">Pre Orders Management</h2>
                <p className="page-subtitle">
                  Manage upcoming drink arrivals and purchase-order listings shown on
                  the public website.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-accent"
              onClick={openAddPreOrder}
            >
              <IconPlus /> Add Pre Order
            </button>
          </div>

          <div className="bm-table-card stats-filter-card">
            <div className="filter-bar">
              <input
                type="date"
                className="bm-input"
                value={preOrderDateFrom}
                onChange={(e) => setPreOrderDateFrom(e.target.value)}
              />
              <input
                type="date"
                className="bm-input"
                value={preOrderDateTo}
                onChange={(e) => setPreOrderDateTo(e.target.value)}
              />
              <button
                type="button"
                className="btn-outline"
                onClick={exportFilteredPreOrdersPdf}
                disabled={preOrderLoading || filteredPreOrders.length === 0}
              >
                Export PDF
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setPreOrderDateFrom("");
                  setPreOrderDateTo("");
                }}
                disabled={!hasPreOrderDateFilter}
              >
                Clear Dates
              </button>
            </div>
            <div className="stats-filter-meta">
              Showing {filteredPreOrders.length} pre-orders for{" "}
              {formatDateRangeLabel(preOrderDateFrom, preOrderDateTo)}.
            </div>
          </div>

          {/* Stats */}
          <div className="bm-stats-grid">
            <div className="bm-stat-card bm-stat-card-soft">
              <div className="bm-stat-head">
                <span className="bm-stat-icon">
                  <IconPreOrders />
                </span>
                <span className="bm-stat-label">Pre-orders</span>
              </div>
              <div className="bm-stat-value">{totalPreOrder}</div>
              <span className="bm-stat-sub">Awaiting arrival</span>
            </div>
            <div className="bm-stat-card">
              <div className="bm-stat-head">
                <span className="bm-stat-icon">
                  <IconInventory />
                </span>
                <span className="bm-stat-label">In Stock</span>
              </div>
              <div className="bm-stat-value">{totalInStock}</div>
              <span className="bm-stat-sub">Available now</span>
            </div>
            <div className="bm-stat-card">
              <div className="bm-stat-head">
                <span className="bm-stat-icon">
                  <IconActivity />
                </span>
                <span className="bm-stat-label">Published</span>
              </div>
              <div
                className="bm-stat-value"
                style={{ color: "var(--success)" }}
              >
                {totalPublished}
              </div>
              <span className="bm-stat-sub">Visible on website</span>
            </div>
            <div className="bm-stat-card">
              <div className="bm-stat-head">
                <span className="bm-stat-icon">
                  <IconInvoice />
                </span>
                <span className="bm-stat-label">Total</span>
              </div>
              <div className="bm-stat-value">{filteredPreOrders.length}</div>
              <span className="bm-stat-sub">Matching created date range</span>
            </div>
          </div>

          {/* Filters */}
          <div className="bm-table-card">
            <div className="filter-bar">
              <input
                className="bm-input"
                placeholder="Search brand, model, ID…"
                value={preOrderSearch}
                onChange={(e) => {
                  setPreOrderSearch(e.target.value);
                  setPreOrderPage(1);
                }}
              />
              <select
                className="bm-input"
                value={preOrderStatusFilter}
                onChange={(e) => {
                  setPreOrderStatusFilter(e.target.value);
                  setPreOrderPage(1);
                }}
              >
                <option value="">All Status</option>
                <option value="pre-order">Pre-Order</option>
                <option value="in-stock">In Stock</option>
              </select>
              <button
                className="btn-outline"
                onClick={() => {
                  setPreOrderSearch("");
                  setPreOrderStatusFilter("");
                  setPreOrderDateFrom("");
                  setPreOrderDateTo("");
                  setPreOrderPage(1);
                }}
              >
                Reset
              </button>
            </div>

            {preOrderError && (
              <div className="bm-alert bm-alert-error">{preOrderError}</div>
            )}

            <div className="preorders-grid">
              {preOrderLoading ? (
                <div className="loading-state">Loading pre-orders...</div>
              ) : preOrders.length === 0 ? (
                <div className="empty-state">No pre-orders found.</div>
              ) : (
                preOrders.map((po) => (
                  <div key={po.id} className="preorder-card">
                    <div className="preorder-image">
                      {getPrimaryImageSrc(po.images) ? (
                        <Image
                          src={getPrimaryImageSrc(po.images) || ""}
                          alt={po.model}
                          fill
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <div className="no-image">No image</div>
                      )}
                      <div
                        className="preorder-status-badge"
                        data-status={po.status}
                      >
                        {po.status === "pre-order" ? "Pre-order" : "In Stock"}
                      </div>
                    </div>
                    <div className="preorder-details">
                      <div className="preorder-header">
                        <h3>
                          {po.brand} {po.model}
                        </h3>
                        <div className="bm-actions">
                          <button
                            type="button"
                            className="bm-action-btn bm-view-btn"
                            onClick={() => setViewPreOrder(po)}
                            title="View"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="bm-action-btn bm-edit-btn"
                            onClick={() => openEditPreOrder(po)}
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="bm-action-btn bm-del-btn"
                            onClick={() => setPreOrderDeleteConfirm(po)}
                            title="Delete"
                          >
                            Del
                          </button>
                        </div>
                      </div>
                      <div className="preorder-meta">
                        <span className="meta-item">
                          <strong>ID:</strong> {po.displayId}
                        </span>
                        {po.year && (
                          <span className="meta-item">
                            <strong>Year:</strong> {po.year}
                          </span>
                        )}
                        {po.cc && (
                          <span className="meta-item">
                            <strong>CC:</strong> {po.cc}
                          </span>
                        )}
                        {po.colour && (
                          <span className="meta-item">
                            <strong>Colour:</strong> {po.colour}
                          </span>
                        )}
                        {po.price && (
                          <span className="meta-item price">
                            <strong>Price:</strong> Rs.{" "}
                            {po.price.toLocaleString()}
                          </span>
                        )}
                        <span className="meta-item">
                          <strong>Published:</strong>{" "}
                          <span
                            style={{
                              color: po.isPublished
                                ? "var(--success)"
                                : "var(--danger)",
                            }}
                          >
                            {po.isPublished ? "Yes" : "No"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPreOrderPages > 1 && (
              <div className="pagination">
                <button
                  className="btn-outline"
                  disabled={preOrderPage === 1}
                  onClick={() => setPreOrderPage(preOrderPage - 1)}
                >
                  ← Prev
                </button>
                <span>
                  Page {preOrderPage} of {totalPreOrderPages}
                </span>
                <button
                  className="btn-outline"
                  disabled={preOrderPage === totalPreOrderPages}
                  onClick={() => setPreOrderPage(preOrderPage + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* View Modal */}
          {viewPreOrder && (
            <div
              className="bm-modal-overlay"
              onClick={() => setViewPreOrder(null)}
            >
              <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="bm-modal-header">
                  <div>
                    <h3>
                      {viewPreOrder.brand} {viewPreOrder.model}
                    </h3>
                    <p className="modal-subtitle">
                      {viewPreOrder.displayId} •{" "}
                      {viewPreOrder.status === "pre-order"
                        ? "Pre-order"
                        : "In Stock"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="bm-close-btn"
                    onClick={() => setViewPreOrder(null)}
                  >
                    <IconClose />
                  </button>
                </div>
                <div className="bm-modal-body">
                  <div className="details-grid">
                    <div>
                      <label>Brand</label>
                      <p>{viewPreOrder.brand}</p>
                    </div>
                    <div>
                      <label>Model</label>
                      <p>{viewPreOrder.model}</p>
                    </div>
                    <div>
                      <label>Year</label>
                      <p>{viewPreOrder.year || "—"}</p>
                    </div>
                    <div>
                      <label>CC</label>
                      <p>{viewPreOrder.cc || "—"}</p>
                    </div>
                    <div>
                      <label>Colour</label>
                      <p>{viewPreOrder.colour || "—"}</p>
                    </div>
                    <div>
                      <label>Price</label>
                      <p>
                        {viewPreOrder.price
                          ? `Rs. ${viewPreOrder.price.toLocaleString()}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <label>Deposit Required</label>
                      <p>{viewPreOrder.depositRequired || "—"}</p>
                    </div>
                    <div>
                      <label>Expected Arrival</label>
                      <p>{viewPreOrder.expectedArrival || "—"}</p>
                    </div>
                    <div>
                      <label>Status</label>
                      <p>
                        {viewPreOrder.status === "pre-order"
                          ? "Pre-order"
                          : "In Stock"}
                      </p>
                    </div>
                    <div>
                      <label>Published</label>
                      <p>{viewPreOrder.isPublished ? "Yes" : "No"}</p>
                    </div>
                  </div>
                  {viewPreOrder.description && (
                    <div className="description-section">
                      <label>Description</label>
                      <p>{viewPreOrder.description}</p>
                    </div>
                  )}
                  {viewPreOrder.images.length > 0 && (
                    <div className="images-section">
                      <label>Images</label>
                      <div className="images-grid">
                        {viewPreOrder.images.map((img) => (
                          <div key={img.id} className="image-item">
                            <Image
                              src={resolveAssetUrl(img.url) ?? ""}
                              alt="Pre-order"
                              width={100}
                              height={100}
                              style={{
                                objectFit: "cover",
                                borderRadius: "4px",
                              }}
                            />
                            {img.isPrimary && (
                              <span className="primary-badge">Primary</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="bm-modal-footer">
                  <button
                    type="button"
                    className="btn-accent"
                    onClick={() => openEditPreOrder(viewPreOrder)}
                  >
                    <IconEdit /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setViewPreOrder(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation */}
          {preOrderDeleteConfirm && (
            <div
              className="bm-modal-overlay"
              onClick={() => setPreOrderDeleteConfirm(null)}
            >
              <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="bm-modal-header">
                  <h3>Delete Pre-Order?</h3>
                  <button
                    type="button"
                    className="bm-close-btn"
                    onClick={() => setPreOrderDeleteConfirm(null)}
                  >
                    <IconClose />
                  </button>
                </div>
                <div className="bm-modal-body">
                  <p>
                    Are you sure you want to delete{" "}
                    <strong>
                      {preOrderDeleteConfirm.brand}{" "}
                      {preOrderDeleteConfirm.model}
                    </strong>
                    ? This action cannot be undone.
                  </p>
                </div>
                <div className="bm-modal-footer">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setPreOrderDeleteConfirm(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handlePreOrderDelete}
                    disabled={preOrderDeleting}
                  >
                    {preOrderDeleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ──────────── CONTACT REQUESTS TAB ──────────── */}
      {activeTab === "contact-requests" && (
        <>
          {/* Header */}
          <div className="bm-page-header">
            <div className="page-title-row">
              <div className="page-title-icon">
                <IconContactRequests />
              </div>
              <div>
                <h2 className="page-title">Contact Requests</h2>
                <p className="page-subtitle">
                  Manage enquiries from the website contact form
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          {contactStats && (
            <div className="bm-stats-grid">
              <div className="bm-stat-card">
                <div className="bm-stat-head">
                  <span className="bm-stat-icon">
                    <IconContactRequests />
                  </span>
                  <span className="bm-stat-label">Total</span>
                </div>
                <div className="bm-stat-value">{contactStats.total}</div>
                <span className="bm-stat-sub">All enquiries</span>
              </div>
              <div className="bm-stat-card">
                <div className="bm-stat-head">
                  <span className="bm-stat-icon">
                    <IconActivity />
                  </span>
                  <span className="bm-stat-label">New</span>
                </div>
                <div
                  className="bm-stat-value"
                  style={{ color: "var(--accent)" }}
                >
                  {contactStats.new}
                </div>
                <span className="bm-stat-sub">Need follow-up</span>
              </div>
              <div className="bm-stat-card">
                <div className="bm-stat-head">
                  <span className="bm-stat-icon">
                    <IconUsers />
                  </span>
                  <span className="bm-stat-label">Contacted</span>
                </div>
                <div
                  className="bm-stat-value"
                  style={{ color: "var(--success)" }}
                >
                  {contactStats.contacted}
                </div>
                <span className="bm-stat-sub">In progress</span>
              </div>
              <div className="bm-stat-card">
                <div className="bm-stat-head">
                  <span className="bm-stat-icon">
                    <IconInvoice />
                  </span>
                  <span className="bm-stat-label">Closed</span>
                </div>
                <div className="bm-stat-value">{contactStats.closed}</div>
                <span className="bm-stat-sub">Resolved items</span>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bm-table-card">
            <div className="filter-bar">
              <input
                className="bm-input"
                placeholder="Search name, email, phone, ID…"
                value={contactSearch}
                onChange={(e) => {
                  setContactSearch(e.target.value);
                  setContactPage(1);
                }}
              />
              <select
                className="bm-input"
                value={contactFilterStatus}
                onChange={(e) => {
                  setContactFilterStatus(e.target.value);
                  setContactPage(1);
                }}
              >
                <option value="">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="closed">Closed</option>
              </select>
              <button
                className="btn-outline"
                onClick={() => {
                  setContactSearch("");
                  setContactFilterStatus("");
                  setContactPage(1);
                }}
              >
                Reset
              </button>
            </div>

            {contactError && (
              <div className="bm-alert bm-alert-error">{contactError}</div>
            )}

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>City</th>
                    <th>Interests</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contactLoading ? (
                    <tr>
                      <td colSpan={9} className="bm-table-empty">
                        Loading…
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="bm-table-empty">
                        No contact requests found.
                      </td>
                    </tr>
                  ) : (
                    requests.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className="display-id">{item.displayId}</span>
                        </td>
                        <td>
                          <strong>{item.name}</strong>
                        </td>
                        <td>{item.email}</td>
                        <td>{item.phone || "—"}</td>
                        <td>{item.city || "—"}</td>
                        <td className="interests-cell">
                          {item.interests || "—"}
                        </td>
                        <td>
                          <span className={statusBadgeClass(item.status)}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td>{formatDate(item.createdAt)}</td>
                        <td>
                          <div className="bm-actions">
                            <button
                              type="button"
                              className="bm-action-btn bm-view-btn"
                              onClick={() => openViewContact(item)}
                            >
                              View
                            </button>
                            {item.status === "new" && (
                              <button
                                type="button"
                                className="bm-action-btn bm-edit-btn"
                                onClick={() =>
                                  handleContactQuickStatus(item, "contacted")
                                }
                              >
                                Contacted
                              </button>
                            )}
                            {item.status !== "closed" && (
                              <button
                                type="button"
                                className="bm-action-btn"
                                onClick={() =>
                                  handleContactQuickStatus(item, "closed")
                                }
                              >
                                Close
                              </button>
                            )}
                            <button
                              type="button"
                              className="bm-action-btn delete"
                              onClick={() => setDeleteContactItem(item)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {contactTotalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn-outline"
                  disabled={contactPage === 1}
                  onClick={() => setContactPage(contactPage - 1)}
                >
                  ← Prev
                </button>
                <span>
                  Page {contactPage} of {contactTotalPages}
                </span>
                <button
                  className="btn-outline"
                  disabled={contactPage === contactTotalPages}
                  onClick={() => setContactPage(contactPage + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* Contact View Modal */}
          {viewContactItem && (
            <div
              className="bm-modal-overlay"
              onClick={() => setViewContactItem(null)}
            >
              <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="bm-modal-header">
                  <h3>{viewContactItem.name}</h3>
                  <button
                    type="button"
                    className="bm-close-btn"
                    onClick={() => setViewContactItem(null)}
                  >
                    <IconClose />
                  </button>
                </div>
                <div className="bm-modal-body">
                  <div className="details-grid">
                    <div>
                      <label>Email</label>
                      <p>{viewContactItem.email}</p>
                    </div>
                    <div>
                      <label>Phone</label>
                      <p>{viewContactItem.phone || "—"}</p>
                    </div>
                    <div>
                      <label>City</label>
                      <p>{viewContactItem.city || "—"}</p>
                    </div>
                    <div>
                      <label>Status</label>
                      <select
                        className="bm-input"
                        value={editContactStatus}
                        onChange={(e) =>
                          setEditContactStatus(e.target.value as ContactStatus)
                        }
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
                  {viewContactItem.interests && (
                    <div className="description-section">
                      <label>Interests</label>
                      <p>{viewContactItem.interests}</p>
                    </div>
                  )}
                  {viewContactItem.message && (
                    <div className="description-section">
                      <label>Message</label>
                      <p>{viewContactItem.message}</p>
                    </div>
                  )}
                  <div className="description-section">
                    <label>Notes</label>
                    <textarea
                      className="bm-input"
                      rows={3}
                      value={editContactNotes}
                      onChange={(e) => setEditContactNotes(e.target.value)}
                      placeholder="Add internal notes..."
                    />
                  </div>
                  {contactSaveError && (
                    <div className="bm-alert bm-alert-error">
                      {contactSaveError}
                    </div>
                  )}
                </div>
                <div className="bm-modal-footer">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setViewContactItem(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-accent"
                    onClick={handleContactSave}
                    disabled={contactSaving}
                  >
                    {contactSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Contact Delete Confirmation */}
          {deleteContactItem && (
            <div
              className="bm-modal-overlay"
              onClick={() => setDeleteContactItem(null)}
            >
              <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="bm-modal-header">
                  <h3>Delete Contact Request?</h3>
                  <button
                    type="button"
                    className="bm-close-btn"
                    onClick={() => setDeleteContactItem(null)}
                  >
                    <IconClose />
                  </button>
                </div>
                <div className="bm-modal-body">
                  <p>
                    Are you sure you want to delete the request from{" "}
                    <strong>{deleteContactItem.name}</strong>? This action
                    cannot be undone.
                  </p>
                </div>
                <div className="bm-modal-footer">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setDeleteContactItem(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleContactDelete}
                    disabled={contactDeleting}
                  >
                    {contactDeleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit/Add Pre-Order Modal */}
      {showPreOrderModal && (
        <div className="bm-modal-overlay" onClick={closePreOrderModal}>
          <div className="bm-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="bm-modal-header">
              <div>
                <h3>
                  {editingPreOrder ? "Edit Pre-Order" : "Add New Pre-Order"}
                </h3>
                <p className="modal-subtitle">
                  {editingPreOrder
                    ? "Update bike pre-order details and images."
                    : "Create a new pre-order listing with complete details."}
                </p>
              </div>
              <button
                type="button"
                className="bm-close-btn"
                onClick={closePreOrderModal}
              >
                <IconClose />
              </button>
            </div>
            <form onSubmit={handlePreOrderSubmit}>
              <div className="bm-modal-body">
                {preOrderModalError && (
                  <div className="bm-alert bm-alert-error">
                    {preOrderModalError}
                  </div>
                )}
                <div className="form-section-title">Product Details</div>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Brand *</label>
                    <input
                      type="text"
                      className="bm-input"
                      list="brands"
                      value={form.brand}
                      onChange={(e) =>
                        setForm({ ...form, brand: e.target.value })
                      }
                      required
                    />
                    <datalist id="brands">
                      {brands.map((b) => (
                        <option key={b.id} value={b.name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="form-field">
                    <label>Model *</label>
                    <input
                      type="text"
                      className="bm-input"
                      list="models"
                      value={form.model}
                      onChange={(e) =>
                        setForm({ ...form, model: e.target.value })
                      }
                      required
                    />
                    <datalist id="models">
                      {models.map((m) => (
                        <option key={m.id} value={m.name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="form-field">
                    <label>Year</label>
                    <input
                      type="number"
                      className="bm-input"
                      value={form.year}
                      onChange={(e) =>
                        setForm({ ...form, year: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>CC</label>
                    <input
                      type="text"
                      className="bm-input"
                      value={form.cc}
                      onChange={(e) => setForm({ ...form, cc: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Colour</label>
                    <input
                      type="text"
                      className="bm-input"
                      value={form.colour}
                      onChange={(e) =>
                        setForm({ ...form, colour: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Price (Rs.)</label>
                    <input
                      type="number"
                      className="bm-input"
                      value={form.price}
                      onChange={(e) =>
                        setForm({ ...form, price: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Deposit Required</label>
                    <input
                      type="text"
                      className="bm-input"
                      value={form.depositRequired}
                      onChange={(e) =>
                        setForm({ ...form, depositRequired: e.target.value })
                      }
                      placeholder="e.g., Rs. 50,000"
                    />
                  </div>
                  <div className="form-field">
                    <label>Expected Arrival</label>
                    <input
                      type="text"
                      className="bm-input"
                      value={form.expectedArrival}
                      onChange={(e) =>
                        setForm({ ...form, expectedArrival: e.target.value })
                      }
                      placeholder="e.g., March 2025"
                    />
                  </div>
                  <div className="form-field">
                    <label>Status</label>
                    <select
                      className="bm-input"
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                    >
                      <option value="pre-order">Pre-Order</option>
                      <option value="in-stock">In Stock</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Sort Order</label>
                    <input
                      type="number"
                      className="bm-input"
                      value={form.sortOrder}
                      onChange={(e) =>
                        setForm({ ...form, sortOrder: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field full-width">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.isPublished}
                        onChange={(e) =>
                          setForm({ ...form, isPublished: e.target.checked })
                        }
                      />
                      Publish on website
                    </label>
                  </div>
                  <div className="form-field full-width">
                    <label>Description</label>
                    <textarea
                      className="bm-input"
                      rows={3}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="Enter product description..."
                    />
                  </div>
                </div>

                <div className="form-section-title">Media</div>
                {/* Existing Images */}
                {editingPreOrder && editingPreOrder.images.length > 0 && (
                  <div className="images-section">
                    <label>Existing Images</label>
                    <div className="images-grid">
                      {editingPreOrder.images.map((img) => (
                        <div key={img.id} className="image-item with-actions">
                          <Image
                            src={resolveAssetUrl(img.url) ?? ""}
                            alt="Pre-order"
                            width={100}
                            height={100}
                            style={{ objectFit: "cover", borderRadius: "4px" }}
                          />
                          <div className="image-actions">
                            {!img.isPrimary && (
                              <button
                                type="button"
                                className="primary-btn"
                                onClick={() =>
                                  setPrimaryImage(editingPreOrder.id, img.id)
                                }
                              >
                                Set Primary
                              </button>
                            )}
                            <button
                              type="button"
                              className="delete-btn"
                              onClick={() =>
                                deleteExistingImage(editingPreOrder.id, img.id)
                              }
                            >
                              Delete
                            </button>
                          </div>
                          {img.isPrimary && (
                            <span className="primary-badge">Primary</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Images */}
                <div className="images-section">
                  <div className="upload-section-head">
                    <div>
                      <label>
                        Add Images (
                        {pendingImages.length +
                          (editingPreOrder?.images.length || 0)}
                        /{MAX_IMAGE_COUNT})
                      </label>
                      <p className="upload-help-text">
                        Upload up to {MAX_IMAGE_COUNT} images. Supported
                        formats: JPG, PNG, WEBP, AVIF. Maximum size 10 MB each.
                      </p>
                    </div>
                    <span className="upload-counter">
                      {pendingImages.length +
                        (editingPreOrder?.images.length || 0)}
                      /{MAX_IMAGE_COUNT}
                    </span>
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={handleImageSelect}
                    className="sr-only-file-input"
                  />
                  <div className="upload-panel">
                    <div className="upload-panel-copy">
                      <strong>Add product gallery images</strong>
                      <p>
                        Choose clear bike photos. The first primary image is
                        what users will see first on the listing.
                      </p>
                    </div>
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
                      <IconPlus /> Choose Images
                    </button>
                  </div>
                  {imageError && (
                    <div className="bm-alert bm-alert-error">{imageError}</div>
                  )}
                  {pendingImages.length > 0 && (
                    <div className="pending-images">
                      {pendingImages.map((f, idx) => (
                        <div
                          key={`${f.name}-${idx}`}
                          className="pending-image-card"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={URL.createObjectURL(f)}
                            alt={f.name}
                            className="pending-image-preview"
                          />
                          <div className="pending-image-meta">
                            <span className="pending-image-name">{f.name}</span>
                            <span className="pending-image-size">
                              {(f.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>
                          <button
                            type="button"
                            className="pending-image-remove"
                            onClick={() => removePendingImage(idx)}
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {pendingImages.length === 0 && (
                    <div className="upload-empty-state">
                      No new images selected yet.
                    </div>
                  )}
                </div>

                {/* PDF Brochure */}
                <div
                  className="form-section-title"
                  style={{ marginTop: "1.5rem" }}
                >
                  Brochure (PDF)
                </div>
                <div className="images-section">
                  {editingPreOrder?.pdfUrl && !pendingPdf && (
                    <div className="pdf-existing">
                      <span>Current brochure:</span>
                      <a
                        href={resolveAssetUrl(editingPreOrder.pdfUrl) ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pdf-link"
                      >
                        View PDF
                      </a>
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
                        if (pdfInputRef.current) pdfInputRef.current.value = "";
                        return;
                      }
                      setPendingPdf(file);
                      if (pdfInputRef.current) pdfInputRef.current.value = "";
                    }}
                    className="sr-only-file-input"
                  />
                  <div className="upload-panel">
                    <div className="upload-panel-copy">
                      <strong>
                        {editingPreOrder?.pdfUrl
                          ? "Change Brochure PDF"
                          : "Upload Brochure PDF"}
                      </strong>
                      <p>
                        Optional. Upload a product brochure PDF (max 20 MB).
                        Customers can view it on the pre-order listing page.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => pdfInputRef.current?.click()}
                    >
                      {editingPreOrder?.pdfUrl ? "Change PDF" : "Upload PDF"}
                    </button>
                  </div>
                  {pdfError && (
                    <div className="bm-alert bm-alert-error">{pdfError}</div>
                  )}
                  {pendingPdf ? (
                    <div
                      className="pending-image-card"
                      style={{ marginTop: "0.5rem" }}
                    >
                      <div className="pending-image-meta">
                        <span className="pending-image-name">
                          {pendingPdf.name}
                        </span>
                        <span className="pending-image-size">
                          {(pendingPdf.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                      <button
                        type="button"
                        className="pending-image-remove"
                        onClick={() => setPendingPdf(null)}
                        title="Remove PDF"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="upload-empty-state">
                      No PDF selected yet.
                    </div>
                  )}
                </div>
              </div>
              <div className="bm-modal-footer">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={closePreOrderModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-accent"
                  disabled={preOrderSaving || uploadingImages}
                >
                  {preOrderSaving
                    ? "Saving..."
                    : uploadingImages
                      ? "Uploading..."
                      : "Save Pre-Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .bm-page {
          --bg-card: var(--panel);
          --border-color: var(--panel-border);
          --text-primary: var(--text);
          --text-secondary: var(--text-soft);
          --bg-secondary: var(--bg-soft);
          --accent-rgb: 201, 168, 76;
          --success-rgb: 5, 150, 105;
        }
        .bm-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(14, 16, 25, 0.58);
          backdrop-filter: blur(3px);
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .bm-modal {
          width: min(720px, 96vw);
          max-height: calc(100vh - 2rem);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: var(--panel);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.32);
          animation: modal-pop 0.2s ease-out;
        }
        .bm-modal.large {
          width: min(960px, 96vw);
        }
        .bm-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 1.15rem;
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--panel);
        }
        .bm-modal-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }
        .modal-subtitle {
          margin: 0.25rem 0 0;
          color: var(--text-secondary);
          font-size: 0.82rem;
        }
        .bm-close-btn {
          width: 2rem;
          height: 2rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .bm-close-btn:hover {
          color: var(--text-primary);
          background: var(--bg-secondary);
        }
        .bm-modal-body {
          padding: 1rem 1.15rem;
          overflow: auto;
          max-height: calc(100vh - 12rem);
          background: var(--panel);
        }
        .bm-modal.large form {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .bm-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.65rem;
          padding: 1rem 1.15rem;
          border-top: 1px solid var(--border-color);
          background: var(--bg-soft);
        }
        @keyframes modal-pop {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .tab-navigation {
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 1.5rem;
          padding: 0 1rem;
          display: flex;
          gap: 0.5rem;
        }
        .tab-button {
          padding: 0.75rem 1.25rem;
          border: none;
          background: none;
          cursor: pointer;
          color: var(--text-secondary);
          font-weight: 500;
          font-size: 0.95rem;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .tab-button.active {
          color: var(--accent);
          border-bottom: 3px solid var(--accent);
          font-weight: 600;
        }
        .filter-bar {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          flex-wrap: wrap;
        }
        .filter-bar .bm-input {
          flex: 1;
          min-width: 200px;
        }
        .stats-filter-card {
          margin-bottom: 1rem;
          overflow: hidden;
        }
        .stats-filter-meta {
          padding: 0 1rem 1rem;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }
        .preorders-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 1.25rem;
          padding: 1.25rem;
        }
        .preorder-card {
          background: var(--bg-card);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition:
            transform 0.2s,
            box-shadow 0.2s;
          border: 1px solid var(--border-color);
        }
        .preorder-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .preorder-image {
          position: relative;
          width: 100%;
          height: 220px;
          background: var(--bg-secondary);
          overflow: hidden;
        }
        .no-image {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }
        .preorder-status-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          backdrop-filter: blur(4px);
        }
        .preorder-status-badge[data-status="pre-order"] {
          background: rgba(var(--accent-rgb), 0.9);
          color: white;
        }
        .preorder-status-badge[data-status="in-stock"] {
          background: rgba(var(--success-rgb), 0.9);
          color: white;
        }
        .preorder-details {
          padding: 1rem;
        }
        .preorder-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }
        .preorder-header h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
        }
        .preorder-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          font-size: 0.875rem;
        }
        .meta-item {
          color: var(--text-secondary);
        }
        .meta-item.price {
          color: var(--accent);
          font-weight: 600;
        }
        .loading-state,
        .empty-state {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }
        .pagination {
          padding: 1rem;
          text-align: center;
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          align-items: center;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .form-section-title {
          margin: 0.25rem 0 0.75rem;
          font-size: 0.84rem;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .form-field.full-width {
          grid-column: 1 / -1;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        .images-section {
          margin-top: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }
        .images-section label {
          display: block;
          font-weight: 600;
          color: var(--text-primary);
        }
        .upload-section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .upload-help-text {
          margin: 0.35rem 0 0;
          font-size: 0.84rem;
          line-height: 1.5;
          color: var(--text-secondary);
          max-width: 640px;
        }
        .upload-counter {
          padding: 0.35rem 0.7rem;
          border-radius: 999px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          font-size: 0.78rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .upload-panel {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.1rem;
          border: 1px dashed
            color-mix(in srgb, var(--accent) 34%, var(--border-color) 66%);
          border-radius: 12px;
          background: color-mix(in srgb, var(--bg-secondary) 84%, white 16%);
          flex-wrap: wrap;
        }
        .upload-panel-copy {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .upload-panel-copy strong {
          color: var(--text-primary);
          font-size: 0.95rem;
        }
        .upload-panel-copy p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.84rem;
          line-height: 1.45;
          max-width: 560px;
        }
        .images-grid {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin-top: 0.5rem;
        }
        .image-item {
          position: relative;
          display: inline-block;
        }
        .image-item.with-actions {
          position: relative;
        }
        .image-actions {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          gap: 0.25rem;
          padding: 0.25rem;
          background: rgba(0, 0, 0, 0.7);
          border-radius: 0 0 4px 4px;
        }
        .image-actions button {
          flex: 1;
          font-size: 0.7rem;
          padding: 0.25rem;
          border: none;
          cursor: pointer;
          border-radius: 2px;
        }
        .primary-btn {
          background: var(--accent);
          color: white;
        }
        .delete-btn {
          background: var(--danger);
          color: white;
        }
        .primary-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          background: var(--accent);
          color: white;
          padding: 0.2rem 0.4rem;
          border-radius: 0.2rem;
          font-size: 0.7rem;
        }
        .pending-images {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.85rem;
        }
        .pending-image-card {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 0.75rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          font-size: 0.875rem;
        }
        .pending-image-preview {
          width: 64px;
          height: 64px;
          object-fit: cover;
          border-radius: 10px;
          flex-shrink: 0;
          border: 1px solid var(--border-color);
          background: var(--bg-card);
        }
        .pending-image-meta {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
        }
        .pending-image-name {
          color: var(--text-primary);
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pending-image-size {
          color: var(--text-secondary);
          font-size: 0.78rem;
        }
        .pending-image-remove {
          width: 2rem;
          height: 2rem;
          border-radius: 999px;
          border: 1px solid
            color-mix(in srgb, var(--danger) 25%, var(--border-color) 75%);
          background: color-mix(in srgb, var(--danger) 10%, var(--bg-card) 90%);
          cursor: pointer;
          color: var(--danger);
          font-size: 1rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pending-image-remove:hover {
          background: color-mix(in srgb, var(--danger) 18%, var(--bg-card) 82%);
        }
        .upload-empty-state {
          padding: 0.9rem 1rem;
          border-radius: 10px;
          border: 1px dashed var(--border-color);
          color: var(--text-secondary);
          font-size: 0.84rem;
          background: color-mix(
            in srgb,
            var(--bg-card) 88%,
            var(--bg-secondary) 12%
          );
        }
        .pdf-existing {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.65rem 0.9rem;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
        .pdf-link {
          color: var(--accent);
          font-weight: 600;
          text-decoration: none;
        }
        .pdf-link:hover {
          text-decoration: underline;
        }
        .sr-only-file-input {
          display: none;
        }
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .description-section {
          margin-top: 1rem;
        }
        .description-section label {
          font-weight: 600;
          margin-bottom: 0.5rem;
          display: block;
        }
        .interests-cell {
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .display-id {
          font-family: monospace;
          font-size: 0.78rem;
        }
        .bm-actions {
          display: flex;
          gap: 0.5rem;
        }
        .bm-action-btn.delete {
          color: var(--danger);
        }
        @media (max-width: 900px) {
          .form-grid,
          .details-grid {
            grid-template-columns: 1fr;
          }
          .preorders-grid {
            grid-template-columns: 1fr;
          }
          .upload-panel {
            align-items: stretch;
          }
          .pending-images {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
