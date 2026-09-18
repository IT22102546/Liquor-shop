"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { exportTableToPdf } from "../../lib/pdf-export";
import { IconBike, IconInventory, IconActivity, IconInvoice } from "../../lib/icons";
import CustomerPurchaseModal from "../../components/CustomerPurchaseModal";
import TablePagination, { paginateRows } from "../../components/TablePagination";

// ── Types ──────────────────────────────────────────────────────────────────
type Brand = { id: number; name: string };
type Model = { id: number; name: string; brandId: number; lowStockThreshold?: number | null };
type Color = { id: number; name: string };
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
type VehicleImage = { id: number; vehicleId: number; url: string; isPrimary: boolean; sortOrder: number; createdAt: string };
type Vehicle = {
  id: number; displayId: string; brandId: number; modelId: number;
  brand: { id: number; name: string }; model: { id: number; name: string; lowStockThreshold?: number | null };
  supplier?: { id: number; name: string; code: string } | null;
  colour: string; year?: number; fileNo?: string; manufactureDate?: string;
  registerNo?: string; chassisNo?: string; engineNo?: string;
  engineCapacityCc?: number;
  condition: "brandnew" | "used";
  mileage: number;
  description?: string;
  registrationType: "registered" | "unregistered";
  purchasePrice?: number;
  taxAmount?: number;
  sellingPrice?: number;
  expenses?: Expense[];
  images?: VehicleImage[];
  status: "available" | "sold"; soldAt?: string;
  createdAt: string;
};
type Expense = { id: number; description: string; amount: number; createdAt: string };
type Group = { brandId: number; brandName: string; modelId: number; modelName: string; count: number; availableCount: number; lowStockThreshold: number; isLowStock: boolean; vehicles: Vehicle[] };

const MAX_IMAGE_COUNT = 6;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 60 * 1024 * 1024;

// ── Combobox (type + suggestions + quick add) ─────────────────────────────
function Combobox({
  value, onChange, options, placeholder, onAdd, addLabel,
}: {
  value: string; onChange: (v: string) => void; options: string[];
  placeholder?: string; onAdd?: (v: string) => Promise<void>; addLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = options.filter((o) => o.toLowerCase().includes(value.toLowerCase()));
  const exactMatch = options.some((o) => o.toLowerCase() === value.toLowerCase());

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAdd = async () => {
    if (!onAdd || !value.trim()) return;
    setAdding(true);
    try { await onAdd(value.trim()); setOpen(false); } finally { setAdding(false); }
  };

  return (
    <div className="bm-combobox" ref={ref}>
      <input
        className="bm-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="bm-combobox-dropdown">
          {filtered.length === 0 && !value && <div className="bm-combobox-empty">Start typing…</div>}
          {filtered.map((o) => (
            <button key={o} type="button" className="bm-combobox-item" onClick={() => { onChange(o); setOpen(false); }}>{o}</button>
          ))}
          {onAdd && value.trim() && !exactMatch && (
            <button type="button" className="bm-combobox-add" onClick={handleAdd} disabled={adding}>
              {adding ? "Adding…" : `+ Add "${value.trim()}" as ${addLabel ?? "option"}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dropdown with + button ─────────────────────────────────────────────────
function SelectWithAdd<T extends { id: number; name: string }>({
  value, onChange, options, placeholder, disabled, onAdd,
}: {
  value: string; onChange: (v: string) => void; options: T[];
  placeholder?: string; disabled?: boolean; onAdd?: () => void;
}) {
  return (
    <div className="bm-select-row">
      <select className="bm-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required>
        <option value="">{placeholder ?? "Select…"}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {onAdd && (
        <button type="button" className="bm-plus-btn" onClick={onAdd} title="Add new">+</button>
      )}
    </div>
  );
}

function SupplierQuickAddModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: (supplier: Supplier) => void;
}) {
  const [form, setForm] = useState<SupplierFormState>({
    name: "",
    contactPerson: "",
    telephone: "",
    address: "",
    fax: "",
    email: "",
    vatRegistrationNo: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  const setField = (key: keyof SupplierFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(`${base}/suppliers`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          contactPerson: form.contactPerson,
          telephone: form.telephone,
          address: form.address,
          fax: form.fax,
          email: form.email,
          vatRegistrationNo: form.vatRegistrationNo,
        }),
      });
      const payload = await response.json() as { data?: Supplier; message?: string };
      if (!response.ok || !payload.data) {
        setError(payload.message ?? "Failed to save supplier");
        return;
      }
      onCreated(payload.data);
      onClose();
    } catch {
      setError("Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal bm-modal-lg" onClick={(event) => event.stopPropagation()}>
        <button className="bm-modal-close" onClick={onClose}>✕</button>
        <h3 className="bm-modal-title">Add Supplier</h3>
        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <form className="bm-modal-form" onSubmit={submit}>
          <div className="bm-field-group">
            <label>Supplier Code</label>
            <input className="bm-input" value="Auto generated on save" disabled />
          </div>
          <div className="bm-field-group">
            <label>Supplier Name *</label>
            <input className="bm-input" value={form.name} onChange={setField("name")} placeholder="Supplier name" required />
          </div>
          <div className="bm-field-group">
            <label>Contact Person</label>
            <input className="bm-input" value={form.contactPerson} onChange={setField("contactPerson")} placeholder="Contact person" />
          </div>
          <div className="bm-field-group">
            <label>Telephone</label>
            <input className="bm-input" value={form.telephone} onChange={setField("telephone")} placeholder="Telephone" />
          </div>
          <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
            <label>Address</label>
            <textarea className="bm-input" rows={3} value={form.address} onChange={setField("address")} placeholder="Address" />
          </div>
          <div className="bm-field-group">
            <label>Fax</label>
            <input className="bm-input" value={form.fax} onChange={setField("fax")} placeholder="Fax" />
          </div>
          <div className="bm-field-group">
            <label>Email</label>
            <input className="bm-input" type="email" value={form.email} onChange={setField("email")} placeholder="Email" />
          </div>
          <div className="bm-field-group">
            <label>VAT Registration No</label>
            <input className="bm-input" value={form.vatRegistrationNo} onChange={setField("vatRegistrationNo")} placeholder="VAT registration no" />
          </div>
          <div className="bm-modal-actions">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-accent" disabled={saving || !form.name.trim()}>{saving ? "Saving..." : "Save Supplier"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Image Uploader (for adding new images) ─────────────────────────────────
function ImageUploader({
  images, onChange, maxImages = MAX_IMAGE_COUNT, required = false, onError,
}: {
  images: File[]; onChange: (files: File[]) => void;
  maxImages?: number; required?: boolean; onError?: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = maxImages - images.length;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    const candidates = Array.from(fileList).slice(0, remaining);

    if (candidates.some((f) => !allowed.includes(f.type))) {
      onError?.("Only JPEG, PNG, WebP, and AVIF images are allowed");
      return;
    }

    if (candidates.some((f) => f.size > MAX_IMAGE_SIZE_BYTES)) {
      onError?.("Each image must be 10MB or smaller");
      return;
    }

    const totalBytes = [...images, ...candidates].reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      onError?.("Total selected image size cannot exceed 60MB");
      return;
    }

    if (candidates.length > 0) onChange([...images, ...candidates]);
  };

  const remove = (idx: number) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div className="bm-img-uploader">
      <div className="bm-img-grid">
        {images.map((file, i) => (
          <div key={i} className={`bm-img-thumb${i === 0 ? " bm-img-primary" : ""}`}>
            <img src={URL.createObjectURL(file)} alt={`Upload ${i + 1}`} />
            {i === 0 && <span className="bm-img-badge">Primary</span>}
            <button type="button" className="bm-img-remove" onClick={() => remove(i)} title="Remove">✕</button>
          </div>
        ))}
        {remaining > 0 && (
          <button type="button" className="bm-img-add-btn" onClick={() => inputRef.current?.click()}>
            <span className="bm-img-add-icon">📷</span>
            <span className="bm-img-add-text">{images.length === 0 ? (required ? "Add Primary Image *" : "Add Image") : `Add More (${remaining} left)`}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif"
        multiple={remaining > 1} style={{ display: "none" }}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />
      {required && images.length === 0 && (
        <p className="bm-img-hint">At least one image is required (the first image will be the primary image)</p>
      )}
      {images.length > 0 && (
        <p className="bm-img-hint">{images.length} image{images.length > 1 ? "s" : ""} selected — first image is the primary</p>
      )}
      <p className="bm-img-hint">Max 10MB per image, 60MB total, up to 6 images</p>
    </div>
  );
}

// ── Server Image Manager (view/delete existing images, upload new) ──────────
function ServerImageManager({
  vehicleId, token, existingImages, onImagesChanged, maxImages = 6,
}: {
  vehicleId: number; token: string; existingImages: VehicleImage[];
  onImagesChanged: (imgs: VehicleImage[]) => void; maxImages?: number;
}) {
  const [images, setImages] = useState<VehicleImage[]>(existingImages);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };
  const remaining = maxImages - images.length;

  useEffect(() => setImages(existingImages), [existingImages]);

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    const candidates = Array.from(fileList).slice(0, remaining);
    setUploadError(null);

    if (candidates.some((f) => !allowed.includes(f.type))) {
      setUploadError("Only JPEG, PNG, WebP, and AVIF images are allowed");
      return;
    }
    if (candidates.some((f) => f.size > MAX_IMAGE_SIZE_BYTES)) {
      setUploadError("Each image must be 10MB or smaller");
      return;
    }
    const batchTotal = candidates.reduce((sum, file) => sum + file.size, 0);
    if (batchTotal > MAX_TOTAL_IMAGE_BYTES) {
      setUploadError("Total selected image size cannot exceed 60MB");
      return;
    }

    const validFiles = candidates.filter((f) => allowed.includes(f.type));
    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      const fd = new FormData();
      validFiles.forEach((f) => fd.append("images", f));
      const r = await fetch(`${base}/vehicles/${vehicleId}/images`, {
        method: "POST", headers: auth, body: fd,
      });
      if (r.ok) {
        const allR = await fetch(`${base}/vehicles/${vehicleId}/images`, { headers: auth });
        const j = await allR.json() as { data: VehicleImage[] };
        const updated = j.data ?? [];
        setImages(updated);
        onImagesChanged(updated);
      } else {
        const ej = await r.json().catch(() => null) as { message?: string } | null;
        setUploadError(ej?.message ?? "Image upload failed");
      }
    } catch {
      setUploadError("Image upload failed due to network error");
    } finally { setUploading(false); }
  };

  const deleteImage = async (imageId: number) => {
    await fetch(`${base}/vehicles/${vehicleId}/images/${imageId}`, { method: "DELETE", headers: auth });
    const allR = await fetch(`${base}/vehicles/${vehicleId}/images`, { headers: auth });
    const j = await allR.json() as { data: VehicleImage[] };
    const updated = j.data ?? [];
    setImages(updated);
    onImagesChanged(updated);
  };

  const makePrimary = async (imageId: number) => {
    const r = await fetch(`${base}/vehicles/${vehicleId}/images/${imageId}/primary`, {
      method: "PATCH", headers: auth,
    });
    if (r.ok) {
      const j = await r.json() as { data: VehicleImage[] };
      const updated = j.data ?? [];
      setImages(updated);
      onImagesChanged(updated);
    }
  };

  return (
    <div className="bm-img-uploader">
      <div className="bm-img-grid">
        {images.map((img) => (
          <div key={img.id} className={`bm-img-thumb${img.isPrimary ? " bm-img-primary" : ""}`}>
            <img src={`${API_URL}${img.url}`} alt="Bike" />
            {img.isPrimary && <span className="bm-img-badge">Primary</span>}
            <div className="bm-img-actions">
              {!img.isPrimary && (
                <button type="button" className="bm-img-action-btn" onClick={() => makePrimary(img.id)} title="Set as primary">⭐</button>
              )}
              <button type="button" className="bm-img-action-btn bm-img-action-del" onClick={() => deleteImage(img.id)} title="Remove">✕</button>
            </div>
          </div>
        ))}
        {remaining > 0 && (
          <button type="button" className="bm-img-add-btn" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <span className="bm-img-add-icon">{uploading ? "⏳" : "📷"}</span>
            <span className="bm-img-add-text">{uploading ? "Uploading…" : `Add Image (${remaining} left)`}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif"
        multiple={remaining > 1} style={{ display: "none" }}
        onChange={(e) => { void uploadFiles(e.target.files); e.target.value = ""; }}
      />
      {uploadError && <p className="bm-img-hint" style={{ color: "var(--danger)" }}>{uploadError}</p>}
      <p className="bm-img-hint">Max 10MB per image, 60MB total, up to 6 images</p>
    </div>
  );
}

// ── Image Gallery (professional viewing) ───────────────────────────────────
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
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
          {sorted.map((img, i) => (
            <button
              key={img.id}
              type="button"
              className={`bm-gallery-thumb${i === selectedIdx ? " active" : ""}`}
              onClick={() => openLightbox(i)}
            >
              <img src={`${API_URL}${img.url}`} alt={`Thumb ${i + 1}`} />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div className="bm-lightbox" onClick={() => setLightboxOpen(false)}>
          <button type="button" className="bm-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Close image">✕</button>
          {sorted.length > 1 && (
            <>
              <button type="button" className="bm-lightbox-nav bm-lightbox-prev" onClick={(e) => { e.stopPropagation(); goPrev(); }} aria-label="Previous image">‹</button>
              <button type="button" className="bm-lightbox-nav bm-lightbox-next" onClick={(e) => { e.stopPropagation(); goNext(); }} aria-label="Next image">›</button>
            </>
          )}
          <div className="bm-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={`${API_URL}${sorted[selectedIdx]?.url}`} alt="Bike large preview" className="bm-lightbox-img" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Liquor Product Modal ────────────────────────────────────────────────
function AddBikeModal({
  token, brands, suppliers, colors, fileNos, onClose, onRefresh, onBrandAdded, onColorAdded, onSupplierAdded,
}: {
  token: string; brands: Brand[]; suppliers: Supplier[]; colors: Color[]; fileNos: string[];
  onClose: () => void; onRefresh: () => void;
  onBrandAdded: (b: Brand) => void; onColorAdded: (c: Color) => void; onSupplierAdded: (supplier: Supplier) => void;
}) {
  const [mode, setMode] = useState<"single" | "bulk" | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>(suppliers);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [form, setForm] = useState({
    brandId: "", modelId: "", supplierId: "", colour: "", year: "", fileNo: "",
    chassisNo: "", engineNo: "", registerNo: "", count: "1",
    engineCapacityCc: "",
    condition: "brandnew", mileage: "0", description: "",
    registrationType: "unregistered",
    purchasePrice: "", taxAmount: "", sellingPrice: "",
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [expenses, setExpenses] = useState<{ description: string; amount: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // New-brand / new-model inline quick-add
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [showNewModel, setShowNewModel] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newModelName, setNewModelName] = useState("");

  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setE = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(k)(e.target.value);
  const setMileageZero = () => set("mileage")("0");
  const bulkCount = Math.max(1, Number.parseInt(form.count || "1", 10) || 1);
  const formatMoney = (value: number) => `Rs. ${value.toLocaleString(undefined, { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  const getBulkPerBikeValue = (value: string) => {
    const total = Number(value);
    if (!Number.isFinite(total) || total < 0) return null;
    return total / bulkCount;
  };
  const totalBulkExpenses = expenses.reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0);
  const perBikeBulkExpenses = totalBulkExpenses / bulkCount;

  useEffect(() => {
    if (!form.brandId) { setModels([]); return; }
    void fetch(`${base}/brands/${form.brandId}/models`, { headers: auth }).then(r => r.json()).then((j: { data: Model[] }) => setModels(j.data ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.brandId]);

  useEffect(() => {
    setSupplierOptions(suppliers);
  }, [suppliers]);

  const addBrand = async () => {
    if (!newBrandName.trim()) return;
    const r = await fetch(`${base}/brands`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ name: newBrandName.trim() }) });
    const j = await r.json() as { data: Brand; message?: string };
    if (!r.ok) { setError((j as { message: string }).message); return; }
    onBrandAdded(j.data);
    setForm((f) => ({ ...f, brandId: String(j.data.id) }));
    setNewBrandName(""); setShowNewBrand(false);
  };

  const addModel = async () => {
    if (!newModelName.trim() || !form.brandId) return;
    const r = await fetch(`${base}/brands/${form.brandId}/models`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ name: newModelName.trim() }) });
    const j = await r.json() as { data: Model; message?: string };
    if (!r.ok) { setError((j as { message: string }).message); return; }
    setModels((m) => [...m, j.data].sort((a, z) => a.name.localeCompare(z.name)));
    setForm((f) => ({ ...f, modelId: String(j.data.id) }));
    setNewModelName(""); setShowNewModel(false);
  };

  const addColor = async (name: string) => {
    const r = await fetch(`${base}/colors`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const j = await r.json() as { data: Color };
    if (r.ok) { onColorAdded(j.data); setForm((f) => ({ ...f, colour: name })); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.brandId || !form.modelId || !form.colour) { setError("Brand, model and colour are required."); return; }
    if (mode === "single" && imageFiles.length === 0) { setError("At least one image is required (primary image)."); return; }
    if (imageFiles.some((f) => f.size > MAX_IMAGE_SIZE_BYTES)) { setError("Each image must be 10MB or smaller"); return; }
    if (imageFiles.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_IMAGE_BYTES) { setError("Total selected image size cannot exceed 60MB"); return; }
    const validExpenses = expenses.filter((ex) => ex.description.trim() && ex.amount);
    setSaving(true);
    try {
      if (mode === "bulk") {
        const r = await fetch(`${base}/vehicles/bulk`, {
          method: "POST", headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId: +form.brandId,
            modelId: +form.modelId,
            supplierId: form.supplierId ? +form.supplierId : undefined,
            colour: form.colour,
            engineCapacityCc: form.engineCapacityCc ? +form.engineCapacityCc : undefined,
            condition: form.condition,
            mileage: form.mileage ? +form.mileage : 0,
            year: form.year ? +form.year : undefined,
            registrationType: form.registrationType,
            purchasePrice: form.purchasePrice ? +form.purchasePrice : undefined,
            taxAmount: form.taxAmount ? +form.taxAmount : undefined,
            sellingPrice: form.sellingPrice ? +form.sellingPrice : undefined,
            expenses: validExpenses.length > 0
              ? validExpenses.map((ex) => ({ description: ex.description.trim(), amount: +ex.amount }))
              : undefined,
            count: +form.count,
          }),
        });
        const j = await r.json() as { data?: Vehicle[]; message?: string };
        if (!r.ok) { setError(j.message ?? "Failed"); return; }
        // If images were added in bulk mode, upload them to each created vehicle
        if (imageFiles.length > 0 && j.data) {
          for (const vehicle of j.data) {
            const fd = new FormData();
            imageFiles.forEach((f) => fd.append("images", f));
            const imgRes = await fetch(`${base}/vehicles/${vehicle.id}/images`, { method: "POST", headers: auth, body: fd });
            if (!imgRes.ok) {
              const imgErr = await imgRes.json().catch(() => null) as { message?: string } | null;
              console.error("Image upload failed:", imgErr);
              setError(`Vehicle created but image upload failed: ${imgErr?.message ?? "Unknown error"}`);
            }
          }
        }
      } else {
        const r = await fetch(`${base}/vehicles`, {
          method: "POST", headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId: +form.brandId,
            modelId: +form.modelId,
            supplierId: form.supplierId ? +form.supplierId : undefined,
            colour: form.colour,
            condition: form.condition,
            mileage: form.mileage ? +form.mileage : 0,
            description: form.description.trim() || undefined,
            year: form.year ? +form.year : undefined,
            engineCapacityCc: form.engineCapacityCc ? +form.engineCapacityCc : undefined,
            fileNo: form.fileNo || undefined,
            chassisNo: form.chassisNo || undefined,
            engineNo: form.engineNo || undefined,
            registerNo: form.registerNo || undefined,
            registrationType: form.registrationType,
            purchasePrice: form.purchasePrice ? +form.purchasePrice : undefined,
            taxAmount: form.taxAmount ? +form.taxAmount : undefined,
            sellingPrice: form.sellingPrice ? +form.sellingPrice : undefined,
            expenses: validExpenses.length > 0
              ? validExpenses.map((ex) => ({ description: ex.description.trim(), amount: +ex.amount }))
              : undefined,
          }),
        });
        const j = await r.json() as { data?: Vehicle; message?: string };
        if (!r.ok) { setError(j.message ?? "Failed"); return; }
        // Upload images after vehicle creation
        if (imageFiles.length > 0 && j.data) {
          const fd = new FormData();
          imageFiles.forEach((f) => fd.append("images", f));
          const imgRes = await fetch(`${base}/vehicles/${j.data.id}/images`, { method: "POST", headers: auth, body: fd });
          if (!imgRes.ok) {
            const imgErr = await imgRes.json().catch(() => null) as { message?: string } | null;
            console.error("Image upload failed:", imgErr);
            setError(`Vehicle created but image upload failed: ${imgErr?.message ?? "Unknown error"}`);
            onRefresh();
            return;
          }
        }
      }
      onRefresh(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload images");
    } finally { setSaving(false); }
  };

  if (!mode) return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal bm-modal-pick" onClick={(e) => e.stopPropagation()}>
        <h3 className="bm-modal-title">Add Liquor Product</h3>
        <div className="bm-mode-grid">
          <button className="bm-mode-card" onClick={() => setMode("single")}>
            <span className="bm-mode-icon">🏍️</span>
            <strong>Single Add</strong>
            <span>Add one product with full details</span>
          </button>
          <button className="bm-mode-card" onClick={() => setMode("bulk")}>
            <span className="bm-mode-icon">📦</span>
            <strong>Bulk Add</strong>
            <span>Add multiple products of the same type</span>
          </button>
        </div>
        <button className="bm-modal-close" onClick={onClose}>✕</button>
      </div>
    </div>
  );

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal bm-modal-lg" onClick={(e) => e.stopPropagation()}>
        <button className="bm-modal-close" onClick={onClose}>✕</button>
        <h3 className="bm-modal-title">{mode === "bulk" ? "Bulk Add Products" : "Add Single Product"}</h3>
        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <form className="bm-modal-form" onSubmit={submit}>
          {/* Images */}
          <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Product Images {mode === "single" ? "*" : "(optional)"}</label>
            <ImageUploader images={imageFiles} onChange={setImageFiles} maxImages={MAX_IMAGE_COUNT} required={mode === "single"} onError={setError} />
          </div>

          {/* Brand */}
          <div className="bm-field-group">
            <label>Brand *</label>
            <SelectWithAdd value={form.brandId} onChange={set("brandId")} options={brands} placeholder="— Select Brand —" onAdd={() => setShowNewBrand(true)} />
            {showNewBrand && (
              <div className="bm-quick-add-row">
                <input className="bm-input bm-input-sm" placeholder="New brand…" value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addBrand(); } if (e.key === "Escape") setShowNewBrand(false); }} autoFocus />
                <button type="button" className="btn-accent bm-add-btn" onClick={addBrand}>Save</button>
                <button type="button" className="bm-action-btn bm-cancel-btn" onClick={() => setShowNewBrand(false)}>✕</button>
              </div>
            )}
          </div>

          {/* Model */}
          <div className="bm-field-group">
            <label>Model *</label>
            <SelectWithAdd value={form.modelId} onChange={set("modelId")} options={models} placeholder="— Select Model —" disabled={!form.brandId} onAdd={form.brandId ? () => setShowNewModel(true) : undefined} />
            {showNewModel && (
              <div className="bm-quick-add-row">
                <input className="bm-input bm-input-sm" placeholder="New model…" value={newModelName} onChange={(e) => setNewModelName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addModel(); } if (e.key === "Escape") setShowNewModel(false); }} autoFocus />
                <button type="button" className="btn-accent bm-add-btn" onClick={addModel}>Save</button>
                <button type="button" className="bm-action-btn bm-cancel-btn" onClick={() => setShowNewModel(false)}>✕</button>
              </div>
            )}
          </div>

          <div className="bm-field-group">
            <label>Supplier</label>
            <SelectWithAdd value={form.supplierId} onChange={set("supplierId")} options={supplierOptions} placeholder="Select supplier" onAdd={() => setShowSupplierModal(true)} />
          </div>

          {/* Colour */}
          <div className="bm-field-group">
            <label>Colour *</label>
            <Combobox value={form.colour} onChange={set("colour")} options={colors.map((c) => c.name)} placeholder="Select or type colour" onAdd={addColor} addLabel="colour" />
          </div>

          {/* Year */}
          <div className="bm-field-group">
            <label>Year</label>
            <input className="bm-input" type="number" min={1990} max={2030} value={form.year} onChange={setE("year")} placeholder="e.g. 2024" />
          </div>

          <div className="bm-field-group">
            <label>Engine Capacity (cc)</label>
            <input className="bm-input" type="number" min={1} value={form.engineCapacityCc} onChange={setE("engineCapacityCc")} placeholder="e.g. 150" />
          </div>

          <div className="bm-field-group">
            <label>Condition *</label>
            <select className="bm-select" value={form.condition} onChange={setE("condition")} required>
              <option value="brandnew">Brand New</option>
              <option value="used">Used</option>
            </select>
          </div>

          <div className="bm-field-group">
            <label>Registration Type *</label>
            <select className="bm-select" value={form.registrationType} onChange={setE("registrationType")} required>
              <option value="unregistered">Unregistered</option>
              <option value="registered">Registered</option>
            </select>
          </div>

          <div className="bm-field-group">
            <label>Mileage</label>
            <div className="bm-quick-add-row">
              <input className="bm-input" type="number" min={0} value={form.mileage} onChange={setE("mileage")} placeholder="e.g. 0" />
              <button type="button" className="btn-outline" onClick={setMileageZero}>Set 0</button>
            </div>
          </div>

          {mode === "bulk" && (
            <>
              <div className="bm-field-group">
                <label>Quantity *</label>
                <input className="bm-input" type="number" min={1} max={500} value={form.count} onChange={setE("count")} required />
              </div>
              <div className="bm-field-group">
                <label>Purchase Price <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(total for this bulk add)</span></label>
                <input className="bm-input" type="number" min={0} step="0.01" value={form.purchasePrice} onChange={setE("purchasePrice")} placeholder="e.g. 350000" />
                {form.purchasePrice && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-soft)" }}>
                    Saved as {formatMoney(getBulkPerBikeValue(form.purchasePrice) ?? 0)} per product across {bulkCount} product{bulkCount === 1 ? "" : "s"}.
                  </div>
                )}
              </div>
              <div className="bm-field-group">
                <label>Tax Amount <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(total for this bulk add)</span></label>
                <input className="bm-input" type="number" min={0} step="0.01" value={form.taxAmount} onChange={setE("taxAmount")} placeholder="e.g. 25000" />
                {form.taxAmount && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-soft)" }}>
                    Saved as {formatMoney(getBulkPerBikeValue(form.taxAmount) ?? 0)} per product across {bulkCount} product{bulkCount === 1 ? "" : "s"}.
                  </div>
                )}
              </div>
              <div className="bm-field-group">
                    <label>Selling Price <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(kept per product)</span></label>
                <input className="bm-input" type="number" min={0} step="0.01" value={form.sellingPrice} onChange={setE("sellingPrice")} placeholder="e.g. 450000" />
              </div>
              <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <label>Additional Expenses <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(enter bulk total; automatically divided per product)</span></label>
                  <button type="button" className="btn-accent bm-add-btn" onClick={() => setExpenses((prev) => [...prev, { description: "", amount: "" }])}>+</button>
                </div>
                {expenses.map((ex, i) => (
                  <div key={i} className="bm-quick-add-row" style={{ marginBottom: 6 }}>
                    <input className="bm-input bm-input-sm" placeholder="Cost description" value={ex.description}
                      onChange={(e) => setExpenses((prev) => prev.map((p, j) => j === i ? { ...p, description: e.target.value } : p))} />
                    <input className="bm-input bm-input-sm" type="number" min={0} step="0.01" placeholder="Amount" value={ex.amount}
                      onChange={(e) => setExpenses((prev) => prev.map((p, j) => j === i ? { ...p, amount: e.target.value } : p))} style={{ maxWidth: 140 }} />
                    <button type="button" className="bm-action-btn bm-del-btn" onClick={() => setExpenses((prev) => prev.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                {expenses.length > 0 && (
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, marginTop: 4, color: "var(--accent)" }}>
                    Bulk additional total: {formatMoney(totalBulkExpenses)} • Per-bike additional total: {formatMoney(perBikeBulkExpenses)}
                  </div>
                )}
              </div>
            </>
          )}

          {mode === "single" && (
            <>
              <div className="bm-field-group">
                <label>Chassis No</label>
                <input className="bm-input" value={form.chassisNo} onChange={setE("chassisNo")} placeholder="e.g. ABC123456" />
              </div>
              <div className="bm-field-group">
                <label>Engine No</label>
                <input className="bm-input" value={form.engineNo} onChange={setE("engineNo")} placeholder="e.g. ENG789012" />
              </div>
              <div className="bm-field-group">
                <label>Register No</label>
                <input className="bm-input" value={form.registerNo} onChange={setE("registerNo")} placeholder="e.g. WP-CAB-1234" />
              </div>
              <div className="bm-field-group">
                <label>File No</label>
                <Combobox value={form.fileNo} onChange={set("fileNo")} options={fileNos} placeholder="Select or type file no" onAdd={(v) => { set("fileNo")(v); return Promise.resolve(); }} addLabel="file no" />
              </div>
              <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
                <label>Description</label>
                <textarea
                  className="bm-input"
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                  placeholder="Add product description"
                />
              </div>

              {/* Pricing */}
              <div className="bm-field-group">
                <label>Purchase Price</label>
                <input className="bm-input" type="number" min={0} step="0.01" value={form.purchasePrice} onChange={setE("purchasePrice")} placeholder="e.g. 350000" />
              </div>
              <div className="bm-field-group">
                <label>Tax Amount</label>
                <input className="bm-input" type="number" min={0} step="0.01" value={form.taxAmount} onChange={setE("taxAmount")} placeholder="e.g. 25000" />
              </div>
              <div className="bm-field-group">
                <label>Selling Price</label>
                <input className="bm-input" type="number" min={0} step="0.01" value={form.sellingPrice} onChange={setE("sellingPrice")} placeholder="e.g. 450000" />
              </div>

              {/* Additional Expenses */}
              <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label>Additional Expenses</label>
                  <button type="button" className="btn-accent bm-add-btn" onClick={() => setExpenses((prev) => [...prev, { description: "", amount: "" }])}>+</button>
                </div>
                {expenses.map((ex, i) => (
                  <div key={i} className="bm-quick-add-row" style={{ marginBottom: 6 }}>
                    <input className="bm-input bm-input-sm" placeholder="Cost description" value={ex.description}
                      onChange={(e) => setExpenses((prev) => prev.map((p, j) => j === i ? { ...p, description: e.target.value } : p))} />
                    <input className="bm-input bm-input-sm" type="number" min={0} step="0.01" placeholder="Amount" value={ex.amount}
                      onChange={(e) => setExpenses((prev) => prev.map((p, j) => j === i ? { ...p, amount: e.target.value } : p))} style={{ maxWidth: 140 }} />
                    <button type="button" className="bm-action-btn bm-del-btn" onClick={() => setExpenses((prev) => prev.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                {expenses.length > 0 && (
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, marginTop: 4, color: "var(--accent)" }}>
                    Total Additional: {expenses.reduce((s, ex) => s + (Number(ex.amount) || 0), 0).toLocaleString()}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="bm-modal-actions">
            <button type="button" className="btn-outline" onClick={() => { setMode(null); setError(null); }}>Back</button>
            <button type="submit" className="btn-accent" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
      {showSupplierModal && (
        <SupplierQuickAddModal
          token={token}
          onClose={() => setShowSupplierModal(false)}
          onCreated={(supplier) => {
            setSupplierOptions((current) => [...current, supplier].sort((left, right) => left.name.localeCompare(right.name)));
            onSupplierAdded(supplier);
            setForm((current) => ({ ...current, supplierId: String(supplier.id) }));
          }}
        />
      )}
    </div>
  );
}

// ── Edit Vehicle Modal ─────────────────────────────────────────────────────
function getSameBulkVehicles(vehicle: Vehicle, relatedVehicles: Vehicle[] = []) {
  const peerSource = relatedVehicles.length > 0 ? relatedVehicles : [vehicle];
  const matchingVehicles = peerSource
    .filter((candidate) => {
      const matchesCore = candidate.brandId === vehicle.brandId
        && candidate.modelId === vehicle.modelId
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
  if (selectedIndex === -1) return [vehicle];

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
}

function getBulkPricingPreview(vehicle: Vehicle, expenses: Expense[] = vehicle.expenses ?? [], relatedVehicles: Vehicle[] = []) {
  const sameBulkVehicles = getSameBulkVehicles(vehicle, relatedVehicles);
  const likelyBulkCount = Math.max(1, sameBulkVehicles.length);
  const rawTotalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
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

  return {
    likelyBulkCount,
    shouldDivideBulkValues,
    displayPurchasePrice,
    displayTaxAmount,
    displayExpenses,
    displayTotalExpenses: displayExpenses.reduce((sum, expense) => sum + expense.amount, 0),
  };
}

function EditVehicleModal({ vehicle, relatedVehicles = [], token, onClose, onSaved }: {
  vehicle: Vehicle; relatedVehicles?: Vehicle[]; token: string; onClose: () => void; onSaved: (v: Vehicle) => void;
}) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const initialPeerVehicles = relatedVehicles.length > 0 ? relatedVehicles : [vehicle];
  const initialPricingPreview = getBulkPricingPreview(vehicle, vehicle.expenses ?? [], initialPeerVehicles);
  const [vehicleDetail, setVehicleDetail] = useState<Vehicle>(vehicle);
  const [bulkPeerVehicles, setBulkPeerVehicles] = useState<Vehicle[]>(initialPeerVehicles);
  const [form, setForm] = useState({
    brandId: String(vehicle.brandId),
    modelId: String(vehicle.modelId),
    supplierId: vehicle.supplier?.id ? String(vehicle.supplier.id) : "",
    chassisNo:  vehicle.chassisNo  ?? "",
    engineNo:   vehicle.engineNo   ?? "",
    registerNo: vehicle.registerNo ?? "",
    fileNo:     vehicle.fileNo     ?? "",
    colour:     vehicle.colour,
    year:       vehicle.year ? String(vehicle.year) : "",
    engineCapacityCc: vehicle.engineCapacityCc ? String(vehicle.engineCapacityCc) : "",
    condition:  vehicle.condition ?? "brandnew",
    mileage:    String(vehicle.mileage ?? 0),
    description: vehicle.description ?? "",
    registrationType: vehicle.registrationType ?? "unregistered",
    purchasePrice: initialPricingPreview.displayPurchasePrice != null ? String(initialPricingPreview.displayPurchasePrice) : "",
    taxAmount: initialPricingPreview.displayTaxAmount != null ? String(initialPricingPreview.displayTaxAmount) : "",
    sellingPrice: vehicle.sellingPrice != null ? String(vehicle.sellingPrice) : "",
  });
  const [vehicleExpenses, setVehicleExpenses] = useState<Expense[]>(initialPricingPreview.displayExpenses);
  const [vehicleImages, setVehicleImages] = useState<VehicleImage[]>(vehicle.images ?? []);
  const [newExpenses, setNewExpenses] = useState<{ description: string; amount: string }[]>([]);
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  // Fetch fresh vehicle data, expenses, and peer bikes on mount
  useEffect(() => {
    void (async () => {
      try {
        const [vehicleResponse, expenseResponse, peersResponse] = await Promise.all([
          fetch(`${base}/vehicles/${vehicle.id}`, { headers: auth }),
          fetch(`${base}/vehicles/${vehicle.id}/expenses`, { headers: auth }),
          fetch(`${base}/vehicles?limit=5000`, { headers: auth }),
        ]);

        let latestVehicle = vehicle;
        let latestExpenses = vehicle.expenses ?? [];
        let latestPeers: Vehicle[] = initialPeerVehicles;

        if (vehicleResponse.ok) {
          const vehiclePayload = await vehicleResponse.json() as { data?: Vehicle };
          if (vehiclePayload.data) {
            latestVehicle = vehiclePayload.data;
            setVehicleDetail(vehiclePayload.data);
            if (vehiclePayload.data.images?.length) {
              setVehicleImages(vehiclePayload.data.images);
            }
          }
        }

        if (expenseResponse.ok) {
          const expensePayload = await expenseResponse.json() as { data?: { expenses?: Expense[] } };
          latestExpenses = expensePayload.data?.expenses ?? latestExpenses;
        }

        if (peersResponse.ok) {
          const peersPayload = await peersResponse.json() as { data?: { vehicles?: Vehicle[] } };
          latestPeers = peersPayload.data?.vehicles ?? latestPeers;
          setBulkPeerVehicles(latestPeers);
        }

        const pricingPreview = getBulkPricingPreview(latestVehicle, latestExpenses, latestPeers);
        setVehicleExpenses(pricingPreview.displayExpenses);
        setForm((current) => ({
          ...current,
          brandId: String(latestVehicle.brandId),
          modelId: String(latestVehicle.modelId),
          supplierId: latestVehicle.supplier?.id ? String(latestVehicle.supplier.id) : "",
          chassisNo: latestVehicle.chassisNo ?? "",
          engineNo: latestVehicle.engineNo ?? "",
          registerNo: latestVehicle.registerNo ?? "",
          fileNo: latestVehicle.fileNo ?? "",
          colour: latestVehicle.colour,
          year: latestVehicle.year ? String(latestVehicle.year) : "",
          engineCapacityCc: latestVehicle.engineCapacityCc ? String(latestVehicle.engineCapacityCc) : "",
          condition: latestVehicle.condition ?? "brandnew",
          mileage: String(latestVehicle.mileage ?? 0),
          description: latestVehicle.description ?? "",
          registrationType: latestVehicle.registrationType ?? "unregistered",
          purchasePrice: pricingPreview.displayPurchasePrice != null ? String(pricingPreview.displayPurchasePrice) : "",
          taxAmount: pricingPreview.displayTaxAmount != null ? String(pricingPreview.displayTaxAmount) : "",
          sellingPrice: latestVehicle.sellingPrice != null ? String(latestVehicle.sellingPrice) : "",
        }));
      } catch {
        // Keep the current bike values if the refresh fails.
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const editPricingPreview = getBulkPricingPreview(vehicleDetail, vehicleDetail.expenses ?? vehicleExpenses, bulkPeerVehicles);

  useEffect(() => {
    void fetch(`${base}/brands`, { headers: auth })
      .then((r) => r.json())
      .then((j: { data: Brand[] }) => setBrands(j.data ?? []));

    void fetch(`${base}/suppliers`, { headers: auth })
      .then((r) => r.json())
      .then((j: { data: Supplier[] }) => setSuppliers(j.data ?? []));

    void fetch(`${base}/colors`, { headers: auth })
      .then((r) => r.json())
      .then((j: { data: Color[] }) => setColors((j.data ?? []).map((c) => c.name)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.brandId) {
      setModels([]);
      return;
    }
    void fetch(`${base}/brands/${form.brandId}/models`, { headers: auth })
      .then((r) => r.json())
      .then((j: { data: Model[] }) => setModels(j.data ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.brandId]);

  const addColor = async (name: string) => {
    const value = name.trim();
    if (!value) return;

    const exists = colors.some((c) => c.toLowerCase() === value.toLowerCase());
    if (exists) return;

    const res = await fetch(`${base}/colors`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: value }),
    });

    if (res.ok) {
      setColors((prev) => [...prev, value].sort((a, b) => a.localeCompare(b)));
      return;
    }

    // If another user created same color concurrently, allow update flow to continue.
    const payload = await res.json() as { message?: string };
    if (res.status !== 409) {
      throw new Error(payload.message ?? "Failed to add color");
    }
    setColors((prev) => [...prev, value].sort((a, b) => a.localeCompare(b)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSaving(true);
    try {
      if (!form.brandId || !form.modelId) {
        setError("Brand and model are required");
        return;
      }

      await addColor(form.colour);

      const r = await fetch(`${base}/vehicles/${vehicle.id}`, {
        method: "PATCH", headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: +form.brandId,
          modelId: +form.modelId,
          supplierId: form.supplierId ? +form.supplierId : null,
          chassisNo: form.chassisNo || undefined,
          engineNo: form.engineNo || undefined,
          registerNo: form.registerNo || undefined,
          fileNo: form.fileNo || undefined,
          colour: form.colour,
          year: form.year ? +form.year : undefined,
          engineCapacityCc: form.engineCapacityCc ? +form.engineCapacityCc : undefined,
          condition: form.condition,
          mileage: form.mileage ? +form.mileage : 0,
          description: form.description.trim() || undefined,
          registrationType: form.registrationType,
          purchasePrice: form.purchasePrice ? +form.purchasePrice : undefined,
          taxAmount: form.taxAmount ? +form.taxAmount : undefined,
          sellingPrice: form.sellingPrice ? +form.sellingPrice : undefined,
        }),
      });
      const j = await r.json() as { data: Vehicle; message?: string };
      if (!r.ok) { setError((j as { message: string }).message); return; }

      // Save new expenses
      for (const ex of newExpenses) {
        if (ex.description.trim() && ex.amount) {
          await fetch(`${base}/vehicles/${vehicle.id}/expenses`, {
            method: "POST", headers: { ...auth, "Content-Type": "application/json" },
            body: JSON.stringify({ description: ex.description.trim(), amount: +ex.amount }),
          });
        }
      }

      onSaved(j.data); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal bm-modal-lg" onClick={(e) => e.stopPropagation()}>
        <button className="bm-modal-close" onClick={onClose}>✕</button>
        <h3 className="bm-modal-title">Edit Vehicle — {vehicle.displayId}</h3>
        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <form className="bm-modal-form" onSubmit={submit}>
          {/* Vehicle Images */}
          <div style={{ gridColumn: "1 / -1", marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Product Images</label>
            <ServerImageManager
              vehicleId={vehicle.id}
              token={token}
              existingImages={vehicleImages}
              onImagesChanged={setVehicleImages}
              maxImages={6}
            />
          </div>
          <div className="bm-fields-grid">
            <div className="bm-field-group">
              <label>Brand</label>
              <select className="bm-select" value={form.brandId} onChange={set("brandId")} required>
                <option value="">Select brand</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="bm-field-group">
              <label>Model</label>
              <select className="bm-select" value={form.modelId} onChange={set("modelId")} required>
                <option value="">Select model</option>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="bm-field-group">
              <label>Supplier</label>
              <SelectWithAdd value={form.supplierId} onChange={(value) => setForm((current) => ({ ...current, supplierId: value }))} options={suppliers} placeholder="Select supplier" onAdd={() => setShowSupplierModal(true)} />
            </div>
            <div className="bm-field-group"><label>Chassis No</label><input className="bm-input" value={form.chassisNo} onChange={set("chassisNo")} placeholder="Chassis number" /></div>
            <div className="bm-field-group"><label>Engine No</label><input className="bm-input" value={form.engineNo} onChange={set("engineNo")} placeholder="Engine number" /></div>
            <div className="bm-field-group"><label>Register No</label><input className="bm-input" value={form.registerNo} onChange={set("registerNo")} placeholder="Register number" /></div>
            <div className="bm-field-group"><label>File No</label><input className="bm-input" value={form.fileNo} onChange={set("fileNo")} placeholder="File number" /></div>
            <div className="bm-field-group">
              <label>Colour</label>
              <Combobox
                value={form.colour}
                onChange={(v) => setForm((f) => ({ ...f, colour: v }))}
                options={colors}
                placeholder="Select or type colour"
                onAdd={addColor}
                addLabel="colour"
              />
            </div>
            <div className="bm-field-group"><label>Year</label><input className="bm-input" type="number" value={form.year} onChange={set("year")} /></div>
            <div className="bm-field-group"><label>Engine Capacity (cc)</label><input className="bm-input" type="number" min={1} value={form.engineCapacityCc} onChange={set("engineCapacityCc")} /></div>
            <div className="bm-field-group">
              <label>Condition</label>
              <select className="bm-select" value={form.condition} onChange={set("condition")}>
                <option value="brandnew">Brand New</option>
                <option value="used">Used</option>
              </select>
            </div>
            <div className="bm-field-group">
              <label>Mileage</label>
              <div className="bm-quick-add-row">
                <input className="bm-input" type="number" min={0} value={form.mileage} onChange={set("mileage")} />
                <button type="button" className="btn-outline" onClick={() => setForm((f) => ({ ...f, mileage: "0" }))}>Set 0</button>
              </div>
            </div>
            <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
              <label>Description</label>
              <textarea
                className="bm-input"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Add product description"
              />
            </div>

            {/* Registration Type */}
            <div className="bm-field-group">
              <label>Registration Type</label>
              <select className="bm-select" value={form.registrationType} onChange={set("registrationType")}>
                <option value="unregistered">Unregistered</option>
                <option value="registered">Registered</option>
              </select>
            </div>

            <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Changes here update only this selected bike. Other bikes from the same bulk add stay unchanged.
                {editPricingPreview.shouldDivideBulkValues ? ` Showing the per-bike amounts divided from the original bulk of ${editPricingPreview.likelyBulkCount} bikes.` : ""}
              </span>
            </div>

            {/* Pricing */}
            <div className="bm-field-group">
              <label>Purchase Price (this bike only)</label>
              <input className="bm-input" type="number" min={0} step="0.01" value={form.purchasePrice} onChange={set("purchasePrice")} placeholder="e.g. 350000" />
            </div>
            <div className="bm-field-group">
              <label>Tax Amount (this bike only)</label>
              <input className="bm-input" type="number" min={0} step="0.01" value={form.taxAmount} onChange={set("taxAmount")} placeholder="e.g. 25000" />
            </div>
            <div className="bm-field-group">
              <label>Selling Price (this bike only)</label>
              <input className="bm-input" type="number" min={0} step="0.01" value={form.sellingPrice} onChange={set("sellingPrice")} placeholder="e.g. 450000" />
            </div>

            {/* Existing Expenses */}
            <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label>Additional Expenses (this bike only) {vehicleExpenses.length > 0 && <span style={{ fontWeight: 400, fontSize: 12, color: "var(--muted)" }}>(Total: Rs. {vehicleExpenses.reduce((s, ex) => s + ex.amount, 0).toLocaleString()})</span>}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {vehicleExpenses.length > 0 && (
                    <button type="button" className="btn-outline" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setShowExpenseDetails((v) => !v)}>
                      {showExpenseDetails ? "Hide Details" : "View Details"}
                    </button>
                  )}
                  <button type="button" className="btn-accent bm-add-btn" onClick={() => setNewExpenses((prev) => [...prev, { description: "", amount: "" }])}>+</button>
                </div>
              </div>

              {/* Expense details table (toggled) */}
              {showExpenseDetails && vehicleExpenses.length > 0 && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
                  <table className="data-table" style={{ margin: 0, width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 12 }}>#</th>
                        <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 12 }}>Description / Reason</th>
                        <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 12 }}>Amount</th>
                        <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 12 }}>Date</th>
                        <th style={{ padding: "6px 10px", fontSize: 12 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicleExpenses.map((ex, i) => (
                        <tr key={ex.id}>
                          <td style={{ padding: "5px 10px", fontSize: 13 }}>{i + 1}</td>
                          <td style={{ padding: "5px 10px", fontSize: 13 }}>{ex.description}</td>
                          <td style={{ textAlign: "right", padding: "5px 10px", fontSize: 13 }}>Rs. {ex.amount.toLocaleString()}</td>
                          <td style={{ padding: "5px 10px", fontSize: 11, color: "var(--muted)" }}>{new Date(ex.createdAt).toLocaleDateString()}</td>
                          <td style={{ padding: "5px 10px", textAlign: "center" }}>
                            <button type="button" className="bm-action-btn bm-del-btn" title="Remove" onClick={async () => {
                              await fetch(`${base}/vehicles/${vehicle.id}/expenses/${ex.id}`, { method: "DELETE", headers: auth });
                              setVehicleExpenses((prev) => prev.filter((e) => e.id !== ex.id));
                            }}>✕</button>
                          </td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                        <td style={{ padding: "6px 10px" }} />
                        <td style={{ padding: "6px 10px" }}>Total</td>
                        <td style={{ textAlign: "right", padding: "6px 10px" }}>Rs. {vehicleExpenses.reduce((s, ex) => s + ex.amount, 0).toLocaleString()}</td>
                        <td colSpan={2} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Inline list for non-details mode */}
              {!showExpenseDetails && vehicleExpenses.map((ex) => (
                <div key={ex.id} className="bm-quick-add-row" style={{ marginBottom: 6, opacity: 0.85 }}>
                  <input className="bm-input bm-input-sm" value={ex.description} disabled />
                  <input className="bm-input bm-input-sm" value={`Rs. ${ex.amount.toLocaleString()}`} disabled style={{ maxWidth: 140 }} />
                  <button type="button" className="bm-action-btn bm-del-btn" title="Remove" onClick={async () => {
                    await fetch(`${base}/vehicles/${vehicle.id}/expenses/${ex.id}`, { method: "DELETE", headers: auth });
                    setVehicleExpenses((prev) => prev.filter((e) => e.id !== ex.id));
                  }}>✕</button>
                </div>
              ))}
              {newExpenses.map((ex, i) => (
                <div key={`new-${i}`} className="bm-quick-add-row" style={{ marginBottom: 6 }}>
                  <input className="bm-input bm-input-sm" placeholder="Cost description" value={ex.description}
                    onChange={(e) => setNewExpenses((prev) => prev.map((p, j) => j === i ? { ...p, description: e.target.value } : p))} />
                  <input className="bm-input bm-input-sm" type="number" min={0} step="0.01" placeholder="Amount for this bike" value={ex.amount}
                    onChange={(e) => setNewExpenses((prev) => prev.map((p, j) => j === i ? { ...p, amount: e.target.value } : p))} style={{ maxWidth: 140 }} />
                  <button type="button" className="bm-action-btn bm-del-btn" onClick={() => setNewExpenses((prev) => prev.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              {(vehicleExpenses.length > 0 || newExpenses.length > 0) && (
                <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, marginTop: 4, color: "var(--accent)" }}>
                  Total Additional: {(
                    vehicleExpenses.reduce((s, ex) => s + ex.amount, 0) +
                    newExpenses.reduce((s, ex) => s + (Number(ex.amount) || 0), 0)
                  ).toLocaleString()}
                </div>
              )}
            </div>
          </div>
          <div className="bm-modal-actions">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-accent" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
          </div>
        </form>
        {showSupplierModal && (
          <SupplierQuickAddModal
            token={token}
            onClose={() => setShowSupplierModal(false)}
            onCreated={(supplier) => {
              setSuppliers((current) => [...current, supplier].sort((left, right) => left.name.localeCompare(right.name)));
              setForm((current) => ({ ...current, supplierId: String(supplier.id) }));
            }}
          />
        )}
      </div>
    </div>
  );
}

function ViewVehicleModal({ vehicle: initialVehicle, token, relatedVehicles = [], onClose }: { vehicle: Vehicle; token: string; relatedVehicles?: Vehicle[]; onClose: () => void }) {
  const [vehicle, setVehicle] = useState<Vehicle>(initialVehicle);
  const [images, setImages] = useState<VehicleImage[]>(initialVehicle.images ?? []);
  const [showExpenses, setShowExpenses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bulkPeerVehicles, setBulkPeerVehicles] = useState<Vehicle[]>(relatedVehicles);
  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  // Fetch fresh vehicle data + images on mount
  useEffect(() => {
    void (async () => {
      try {
        const [vRes, iRes, peersRes] = await Promise.all([
          fetch(`${base}/vehicles/${initialVehicle.id}`, { headers: auth }),
          fetch(`${base}/vehicles/${initialVehicle.id}/images`, { headers: auth }),
          fetch(`${base}/vehicles?limit=5000`, { headers: auth }),
        ]);
        if (vRes.ok) {
          const j = await vRes.json() as { data: Vehicle };
          setVehicle(j.data);
          if (j.data.images && j.data.images.length > 0) setImages(j.data.images);
        }
        if (iRes.ok) {
          const ij = await iRes.json() as { data: VehicleImage[] };
          if (ij.data && ij.data.length > 0) setImages(ij.data);
        }
        if (peersRes.ok) {
          const peersPayload = await peersRes.json() as { data?: { vehicles?: Vehicle[] } };
          setBulkPeerVehicles(peersPayload.data?.vehicles ?? relatedVehicles);
        }
      } finally { setLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatCurrency = (value: number) => `Rs. ${value.toLocaleString(undefined, { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  const expenses = vehicle.expenses ?? [];
  const peerVehicles = bulkPeerVehicles.length > 0 ? bulkPeerVehicles : relatedVehicles;
  const {
    likelyBulkCount,
    shouldDivideBulkValues,
    displayPurchasePrice,
    displayTaxAmount,
    displayExpenses,
    displayTotalExpenses,
  } = getBulkPricingPreview(vehicle, expenses, peerVehicles);

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal bm-view-modal" onClick={(e) => e.stopPropagation()}>
        <button className="bm-modal-close" onClick={onClose}>✕</button>
        <h3 className="bm-modal-title">
          Product Details — {vehicle.displayId}
          <span className={`badge ${vehicle.status === "available" ? "badge-active" : "badge-pending"}`} style={{ marginLeft: 10, fontSize: 11, verticalAlign: "middle" }}>
            {vehicle.status === "available" ? "Available" : "Sold"}
          </span>
        </h3>
        {loading && <div style={{ textAlign: "center", padding: 12, color: "var(--muted)" }}>Loading details…</div>}

        <div className="bm-view-layout">
          {/* Left: Image Gallery */}
          <div className="bm-view-left">
            <ImageGallery images={images} />
            {/* Quick info below gallery */}
            <div className="bm-view-quick-info">
              <div className="bm-view-quick-item">
                <span className="bm-view-quick-label">Brand</span>
                <span className="bm-view-quick-value">{vehicle.brand.name}</span>
              </div>
              <div className="bm-view-quick-item">
                <span className="bm-view-quick-label">Model</span>
                <span className="bm-view-quick-value">{vehicle.model.name}</span>
              </div>
              <div className="bm-view-quick-item">
                <span className="bm-view-quick-label">Colour</span>
                <span className="bm-view-quick-value">{vehicle.colour}</span>
              </div>
              <div className="bm-view-quick-item">
                <span className="bm-view-quick-label">Condition</span>
                <span className="bm-view-quick-value">{vehicle.condition === "used" ? "Used" : "Brand New"}</span>
              </div>
            </div>
          </div>

          {/* Right: Details */}
          <div className="bm-view-right">
            {/* Vehicle Info Section */}
            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Product Information</h4>
              <div className="bm-view-detail-grid">
                <div className="bm-view-detail"><span className="bm-view-detail-label">Year</span><span className="bm-view-detail-value">{vehicle.year ?? "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Supplier</span><span className="bm-view-detail-value">{vehicle.supplier ? `${vehicle.supplier.name} (${vehicle.supplier.code})` : "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Engine Capacity</span><span className="bm-view-detail-value">{vehicle.engineCapacityCc ? `${vehicle.engineCapacityCc} cc` : "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Mileage</span><span className="bm-view-detail-value">{(vehicle.mileage ?? 0).toLocaleString()} km</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Registration</span><span className="bm-view-detail-value">{vehicle.registrationType === "registered" ? "Registered" : "Unregistered"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">File No</span><span className="bm-view-detail-value">{vehicle.fileNo ?? "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Register No</span><span className="bm-view-detail-value">{vehicle.registerNo ?? "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Chassis No</span><span className="bm-view-detail-value">{vehicle.chassisNo ?? "—"}</span></div>
                <div className="bm-view-detail"><span className="bm-view-detail-label">Engine No</span><span className="bm-view-detail-value">{vehicle.engineNo ?? "—"}</span></div>
              </div>
              {vehicle.description && (
                <div className="bm-view-desc">
                  <span className="bm-view-detail-label">Description</span>
                  <p className="bm-view-desc-text">{vehicle.description}</p>
                </div>
              )}
            </div>

            {/* Pricing Section */}
            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Pricing</h4>
              <div className="bm-view-detail-grid">
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">Purchase Price</span>
                  <span className="bm-view-detail-value bm-view-price">{displayPurchasePrice != null ? formatCurrency(displayPurchasePrice) : "—"}</span>
                </div>
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">Tax Amount</span>
                  <span className="bm-view-detail-value bm-view-price">{displayTaxAmount != null ? formatCurrency(displayTaxAmount) : "—"}</span>
                </div>
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">Selling Price</span>
                  <span className="bm-view-detail-value bm-view-price bm-view-price-highlight">{vehicle.sellingPrice != null ? formatCurrency(vehicle.sellingPrice) : "—"}</span>
                </div>
              </div>
              {shouldDivideBulkValues && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-soft)" }}>
                  Showing per-bike values divided across {likelyBulkCount} bikes from the same bulk entry.
                </div>
              )}
            </div>

            {/* Expenses Section */}
            {(displayExpenses.length > 0 || displayTotalExpenses > 0) && (
              <div className="bm-view-section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h4 className="bm-view-section-title" style={{ margin: 0 }}>
                    Additional Expenses
                    <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-soft)", marginLeft: 8 }}>
                      {formatCurrency(displayTotalExpenses)}
                    </span>
                  </h4>
                  {displayExpenses.length > 0 && (
                    <button
                      type="button"
                      className="bm-view-toggle-btn"
                      onClick={() => setShowExpenses((v) => !v)}
                    >
                      {showExpenses ? "Hide" : "View Details"}
                    </button>
                  )}
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
                        {displayExpenses.map((ex, i) => (
                          <tr key={ex.id}>
                            <td style={{ padding: "6px 10px" }}>{i + 1}</td>
                            <td style={{ padding: "6px 10px" }}>{ex.description}</td>
                            <td style={{ textAlign: "right", padding: "6px 10px" }}>{formatCurrency(ex.amount)}</td>
                            <td style={{ padding: "6px 10px", fontSize: 12, color: "var(--text-soft)" }}>{new Date(ex.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                          <td style={{ padding: "8px 10px" }} />
                          <td style={{ padding: "8px 10px" }}>Total</td>
                          <td style={{ textAlign: "right", padding: "8px 10px" }}>{formatCurrency(displayTotalExpenses)}</td>
                          <td />
                        </tr>
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

// ── Group Row (brand+model card) ───────────────────────────────────────────
function GroupRow({ group, token, onRefresh }: { group: Group; token: string; onRefresh: () => void }) {
  const [open, setOpen]         = useState(false);
  const [viewV, setViewV]       = useState<Vehicle | null>(null);
  const [editV, setEditV]       = useState<Vehicle | null>(null);
  const [saleV, setSaleV]       = useState<Vehicle | null>(null);
  const [delConfirm, setDelConfirm] = useState<number | null>(null);
  const [editingAlert, setEditingAlert] = useState<{ enabled: boolean; threshold: string } | null>(null);
  const [savingAlert, setSavingAlert] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  const [vehicles, setVehicles] = useState<Vehicle[]>(group.vehicles);
  useEffect(() => setVehicles(group.vehicles), [group.vehicles]);

  const deleteVehicle = async (id: number) => {
    await fetch(`${base}/vehicles/${id}`, { method: "DELETE", headers: auth });
    onRefresh(); setDelConfirm(null);
  };

  const available = group.availableCount ?? vehicles.filter((v) => v.status === "available").length;

  const saveAlertSettings = async () => {
    if (!editingAlert) return;
    if (editingAlert.enabled && (!editingAlert.threshold.trim() || Number(editingAlert.threshold) <= 0)) {
      setAlertError("Enter a bike count greater than 0 for the low stock alert.");
      return;
    }

    setSavingAlert(true);
    setAlertError(null);
    try {
      const response = await fetch(`${base}/models/${group.modelId}`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: group.modelName,
          lowStockThreshold: editingAlert.enabled && editingAlert.threshold.trim() !== "" ? Number(editingAlert.threshold) : 0,
        }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        setAlertError(payload?.message ?? "Failed to save low stock alert.");
        return;
      }
      setEditingAlert(null);
      onRefresh();
    } catch {
      setAlertError("Failed to save low stock alert.");
    } finally {
      setSavingAlert(false);
    }
  };

  return (
    <>
      <tr className="bm-group-row">
        <td>
          <button type="button" className="bm-expand-btn" onClick={() => setOpen((v) => !v)}>
            <span className={`bm-chevron${open ? " open" : ""}`}>▾</span>
          </button>
        </td>
        <td><strong>{group.brandName}</strong></td>
        <td>
          <div style={{ display: "grid", gap: 2 }}>
            <span>{group.modelName}</span>
          </div>
        </td>
        <td className="td-num"><span className={`badge ${group.isLowStock ? "badge-warning" : "badge-active"}`}>{available}</span></td>
        <td className="td-num">{group.count}</td>
        <td>
          <div className="bm-row-actions">
            {group.isLowStock && <span className="badge badge-warning">Low Stock</span>}
            <button
              type="button"
              className="bm-action-btn bm-edit-btn"
              onClick={() => {
                setAlertError(null);
                setEditingAlert({
                  enabled: group.lowStockThreshold > 0,
                  threshold: group.lowStockThreshold > 0 ? String(group.lowStockThreshold) : "",
                });
              }}
              title="Set low stock alert"
            >
              Alert
            </button>
          </div>
        </td>
      </tr>
      {editingAlert && (
        <tr>
          <td colSpan={6}>
            <div className="bm-inline-confirm bm-setting-panel">
              <div className="bm-setting-panel-header">
                <strong>{group.brandName} {group.modelName} low stock setting</strong>
                <label className="bm-setting-toggle">
                  <input
                    type="checkbox"
                    checked={editingAlert.enabled}
                    onChange={(event) => setEditingAlert((current) => current ? { ...current, enabled: event.target.checked, threshold: event.target.checked ? current.threshold : "" } : current)}
                  />
                  Enable alert
                </label>
              </div>
              {editingAlert.enabled && (
                <input
                  className="bm-input"
                  style={{ maxWidth: 280 }}
                  type="number"
                  min={1}
                  placeholder="Show alert when available bikes reach this number"
                  value={editingAlert.threshold}
                  onChange={(event) => setEditingAlert((current) => current ? { ...current, threshold: event.target.value } : current)}
                />
              )}
              {alertError && <div className="bm-alert bm-alert-error">{alertError}</div>}
              <div className="bm-setting-panel-actions">
                <button type="button" className="btn-accent" onClick={() => void saveAlertSettings()} disabled={savingAlert}>{savingAlert ? "Saving..." : "Save Alert"}</button>
                <button type="button" className="btn-outline" onClick={() => setEditingAlert(null)}>Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}
      {open && vehicles.map((v) => {
        const primaryImg = (v.images ?? []).find((img) => img.isPrimary) ?? (v.images ?? [])[0];
        return (
        <tr key={v.id} className="bm-vehicle-row">
          <td>
            {primaryImg ? (
              <img src={`${API_URL}${primaryImg.url}`} alt="" className="bm-row-thumb" />
            ) : (
              <span className="bm-row-thumb-empty">🖼️</span>
            )}
          </td>
          <td><span className="bm-display-id">{v.displayId}</span></td>
          <td>
            <span className="bm-vehicle-detail">{v.colour}{v.year ? ` · ${v.year}` : ""}</span>
            <span className="bm-vehicle-meta">
              {(v.condition === "used" ? "Used" : "Brand New") + ` · ${v.mileage ?? 0} km`}
            </span>
            <span className="bm-vehicle-meta">
              {v.chassisNo ? `CH: ${v.chassisNo}` : <em className="bm-missing">No chassis</em>}
            </span>
          </td>
          <td><span className={`badge ${v.status === "available" ? "badge-active" : "badge-pending"}`}>{v.status}</span></td>
          <td>{(v.images ?? []).length > 0 ? `${(v.images ?? []).length} 📷` : ""}</td>
          <td>
            <div className="bm-row-actions">
              <button type="button" className="bm-action-btn bm-view-btn" onClick={() => setViewV(v)} title="View details">View</button>
              <button type="button" className="bm-action-btn bm-edit-btn" onClick={() => setEditV(v)} title="Edit">✎</button>
              {v.status === "available" && (
                <button type="button" className="bm-action-btn bm-sold-btn" onClick={() => setSaleV(v)} title="Sell to customer">✅</button>
              )}
              <button type="button" className="bm-action-btn bm-del-btn" onClick={() => setDelConfirm(v.id)} title="Delete">🗑</button>
            </div>
          </td>
        </tr>
        );
      })}
      {viewV && <ViewVehicleModal vehicle={viewV} relatedVehicles={vehicles} token={token} onClose={() => setViewV(null)} />}
      {editV && <EditVehicleModal vehicle={editV} relatedVehicles={vehicles} token={token} onClose={() => setEditV(null)} onSaved={() => { setEditV(null); onRefresh(); }} />}
      {saleV && (
        <CustomerPurchaseModal
          token={token}
          itemType="BIKE"
          itemId={saleV.id}
          itemLabel={`${saleV.displayId} | ${saleV.brand.name} ${saleV.model.name} (${saleV.colour})`}
          currentSellingPrice={saleV.sellingPrice}
          onClose={() => setSaleV(null)}
          onSaved={() => {
            setSaleV(null);
            onRefresh();
          }}
        />
      )}
      {delConfirm !== null && (
        <tr><td colSpan={6}>
          <div className="bm-inline-confirm">
            <span>Delete this vehicle permanently?</span>
            <button className="bm-btn-danger" onClick={() => deleteVehicle(delConfirm)}>Delete</button>
            <button className="btn-outline" onClick={() => setDelConfirm(null)}>Cancel</button>
          </div>
        </td></tr>
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
function groupByBrandModel(vehicles: Vehicle[]): Group[] {
  const map = new Map<string, Group>();

  for (const v of vehicles) {
    const key = `${v.brandId}_${v.modelId}`;
    const existing = map.get(key);
    const threshold = v.model.lowStockThreshold ?? 0;
    if (!existing) {
      map.set(key, {
        brandId: v.brandId,
        brandName: v.brand.name,
        modelId: v.modelId,
        modelName: v.model.name,
        count: 1,
        availableCount: v.status === "available" ? 1 : 0,
        lowStockThreshold: threshold,
        isLowStock: threshold > 0 && (v.status === "available" ? 1 : 0) <= threshold,
        vehicles: [v],
      });
      continue;
    }
    existing.count += 1;
    existing.availableCount += v.status === "available" ? 1 : 0;
    existing.vehicles.push(v);
    existing.isLowStock = existing.lowStockThreshold > 0 && existing.availableCount <= existing.lowStockThreshold;
  }

  return Array.from(map.values()).sort((a, b) => {
    const brandComp = a.brandName.localeCompare(b.brandName);
    if (brandComp !== 0) return brandComp;
    return a.modelName.localeCompare(b.modelName);
  });
}

export default function BikeInventoryPage() {
  const { token } = useAdmin();
  const [groups, setGroups] = useState<Group[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [fileNos, setFileNos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [statsSource, setStatsSource] = useState<Vehicle[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [filters, setFilters] = useState({
    brandId: "",
    modelId: "",
    colour: "",
    year: "",
    fileNo: "",
    registerNo: "",
    chassisNo: "",
    search: "",
  });

  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  const setFilter = (key: keyof typeof filters) => (value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      brandId: "",
      modelId: "",
      colour: "",
      year: "",
      fileNo: "",
      registerNo: "",
      chassisNo: "",
      search: "",
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ status: "available", page: "1", limit: "5000" });
      if (filters.brandId) params.set("brandId", filters.brandId);
      if (filters.modelId) params.set("modelId", filters.modelId);
      if (filters.colour) params.set("colour", filters.colour);
      if (filters.year) params.set("year", filters.year);
      if (filters.fileNo) params.set("fileNo", filters.fileNo);
      if (filters.registerNo) params.set("registerNo", filters.registerNo);
      if (filters.chassisNo) params.set("chassisNo", filters.chassisNo);
      if (filters.search) params.set("search", filters.search);

      const vRes = await fetch(`${base}/vehicles?${params.toString()}`, {
        headers: auth,
        cache: "no-store",
      });
      const vj = await vRes.json() as { data?: { vehicles?: Vehicle[] }; message?: string };
      if (!vRes.ok) {
        throw new Error(vj.message ?? "Failed to load bikes");
      }

      const vehicles = vj.data?.vehicles ?? [];
      setStatsSource(vehicles);
      setGroups(groupByBrandModel(vehicles));

      const [bRes, mRes, sRes, cRes, fRes] = await Promise.allSettled([
        fetch(`${base}/brands`, { headers: auth, cache: "no-store" }),
        fetch(`${base}/models`, { headers: auth, cache: "no-store" }),
        fetch(`${base}/suppliers`, { headers: auth, cache: "no-store" }),
        fetch(`${base}/colors`, { headers: auth, cache: "no-store" }),
        fetch(`${base}/vehicles/filenos`, { headers: auth, cache: "no-store" }),
      ]);

      if (bRes.status === "fulfilled" && bRes.value.ok) {
        const bj = await bRes.value.json() as { data?: Brand[] };
        setBrands(bj.data ?? []);
      }
      if (mRes.status === "fulfilled" && mRes.value.ok) {
        const mj = await mRes.value.json() as { data?: Model[] };
        setModels(mj.data ?? []);
      }
      if (sRes.status === "fulfilled" && sRes.value.ok) {
        const sj = await sRes.value.json() as { data?: Supplier[] };
        setSuppliers(sj.data ?? []);
      }
      if (cRes.status === "fulfilled" && cRes.value.ok) {
        const cj = await cRes.value.json() as { data?: Color[] };
        setColors(cj.data ?? []);
      }
      if (fRes.status === "fulfilled" && fRes.value.ok) {
        const fj = await fRes.value.json() as { data?: string[] };
        setFileNos(fj.data ?? []);
      }
    } catch (err) {
      setStatsSource([]);
      setGroups([]);
      setLoadError(err instanceof Error ? err.message : "Failed to load bikes");
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => { setPage(1); }, [filters, pageSize]);
  const pagedGroups = useMemo(() => paginateRows(groups, page, pageSize), [groups, page, pageSize]);

  const totalAvailable = statsSource.length;
  const brandCount = new Set(statsSource.map((v) => v.brandId)).size;
  const modelCount = new Set(statsSource.map((v) => v.modelId)).size;
  const incompleteCount = statsSource.filter((v) => !v.fileNo || !v.registerNo).length;
  const lowStockGroups = groups.filter((group) => group.isLowStock);

  const exportBikeInventoryPdf = () => {
    exportTableToPdf({
      fileName: "bike-inventory-report",
      title: "Bike Inventory Report",
      subtitle: "All available bikes currently loaded in Bike Inventory tab",
      rows: statsSource,
      columns: [
        { header: "Display ID", value: (vehicle) => vehicle.displayId },
        { header: "Brand", value: (vehicle) => vehicle.brand?.name ?? "-" },
        { header: "Model", value: (vehicle) => vehicle.model?.name ?? "-" },
        { header: "Supplier", value: (vehicle) => vehicle.supplier ? `${vehicle.supplier.name} (${vehicle.supplier.code})` : "-" },
        { header: "Colour", value: (vehicle) => vehicle.colour },
        { header: "Year", value: (vehicle) => vehicle.year ?? "-" },
        { header: "Manufacture Date", value: (vehicle) => vehicle.manufactureDate ? new Date(vehicle.manufactureDate).toLocaleDateString() : "-" },
        { header: "Condition", value: (vehicle) => vehicle.condition === "brandnew" ? "Brand New" : "Used" },
        { header: "Mileage", value: (vehicle) => vehicle.mileage ?? "-" },
        { header: "Engine Capacity (cc)", value: (vehicle) => vehicle.engineCapacityCc ?? "-" },
        { header: "File No", value: (vehicle) => vehicle.fileNo ?? "-" },
        { header: "Register No", value: (vehicle) => vehicle.registerNo ?? "-" },
        { header: "Chassis No", value: (vehicle) => vehicle.chassisNo ?? "-" },
        { header: "Engine No", value: (vehicle) => vehicle.engineNo ?? "-" },
        { header: "Registration", value: (vehicle) => vehicle.registrationType === "registered" ? "Registered" : "Unregistered" },
        { header: "Purchase Price", value: (vehicle) => vehicle.purchasePrice ?? "-" },
        { header: "Tax Amount", value: (vehicle) => vehicle.taxAmount ?? "-" },
        {
          header: "Additional Expenses Total",
          value: (vehicle) => (vehicle.expenses?.length
            ? vehicle.expenses.reduce((sum, expense) => sum + (expense.amount ?? 0), 0)
            : "-"),
        },
        {
          header: "Expense Breakdown",
          value: (vehicle) => vehicle.expenses?.length
            ? vehicle.expenses.map((expense) => `${expense.description}: ${expense.amount}`).join(" | ")
            : "-",
        },
        { header: "Selling Price", value: (vehicle) => vehicle.sellingPrice ?? "-" },
        { header: "Status", value: (vehicle) => vehicle.status },
        { header: "Image Count", value: (vehicle) => vehicle.images?.length ?? 0 },
        { header: "Added At", value: (vehicle) => new Date(vehicle.createdAt).toLocaleString() },
        { header: "Description", value: (vehicle) => vehicle.description ?? "-" },
      ],
    });
  };

  const filteredModels = filters.brandId
    ? models.filter((m) => String(m.brandId) === filters.brandId)
    : models;

  const years = Array.from(new Set(statsSource.map((v) => v.year).filter((v): v is number => typeof v === "number"))).sort((a, b) => b - a);

  useEffect(() => {
    if (!filters.brandId || !filters.modelId) return;
    const exists = filteredModels.some((m) => String(m.id) === filters.modelId);
    if (!exists) {
      setFilters((prev) => ({ ...prev, modelId: "" }));
    }
  }, [filters.brandId, filters.modelId, filteredModels]);

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconBike /></div>
          <div>
            <h2 className="page-title">Bike Inventory</h2>
            <p className="page-subtitle">{totalAvailable} bikes available in stock</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button type="button" className="btn-outline" onClick={exportBikeInventoryPdf}>Export PDF</button>
          <button className="btn-accent" onClick={() => setShowAdd(true)}>+ Add Liquor Product</button>
        </div>
      </div>

      <div className="bm-stats-grid">
        <div className="bm-stat-card">
          <div className="bm-stat-head">
            <span className="bm-stat-icon"><IconBike /></span>
            <span className="bm-stat-label">Available Bikes</span>
          </div>
          <strong className="bm-stat-value">{totalAvailable}</strong>
          <span className="bm-stat-sub">Current filtered stock</span>
        </div>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head">
            <span className="bm-stat-icon"><IconInventory /></span>
            <span className="bm-stat-label">Brands</span>
          </div>
          <strong className="bm-stat-value">{brandCount}</strong>
          <span className="bm-stat-sub">Active in results</span>
        </div>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head">
            <span className="bm-stat-icon"><IconActivity /></span>
            <span className="bm-stat-label">Models</span>
          </div>
          <strong className="bm-stat-value">{modelCount}</strong>
          <span className="bm-stat-sub">Variant coverage</span>
        </div>
        <div className="bm-stat-card bm-stat-card-warn">
          <div className="bm-stat-head">
            <span className="bm-stat-icon"><IconInvoice /></span>
            <span className="bm-stat-label">Low Stock Alerts</span>
          </div>
          <strong className="bm-stat-value">{lowStockGroups.length}</strong>
          <span className="bm-stat-sub">Need details: {incompleteCount}</span>
        </div>
      </div>

      <div className="bm-filter-card">
        <div className="bm-filter-grid">
          <div className="bm-field-group">
            <label>Brand</label>
            <select className="bm-select" value={filters.brandId} onChange={(e) => setFilter("brandId")(e.target.value)}>
              <option value="">All Brands</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="bm-field-group">
            <label>Model</label>
            <select className="bm-select" value={filters.modelId} onChange={(e) => setFilter("modelId")(e.target.value)}>
              <option value="">All Models</option>
              {filteredModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="bm-field-group">
            <label>Colour</label>
            <select className="bm-select" value={filters.colour} onChange={(e) => setFilter("colour")(e.target.value)}>
              <option value="">All Colours</option>
              {colors.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="bm-field-group">
            <label>Year</label>
            <select className="bm-select" value={filters.year} onChange={(e) => setFilter("year")(e.target.value)}>
              <option value="">All Years</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="bm-field-group">
            <label>File No</label>
            <select className="bm-select" value={filters.fileNo} onChange={(e) => setFilter("fileNo")(e.target.value)}>
              <option value="">All File Nos</option>
              {fileNos.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="bm-field-group">
            <label>Register No</label>
            <input className="bm-input" value={filters.registerNo} onChange={(e) => setFilter("registerNo")(e.target.value)} placeholder="Type register no" />
          </div>
          <div className="bm-field-group">
            <label>Chassis No</label>
            <input className="bm-input" value={filters.chassisNo} onChange={(e) => setFilter("chassisNo")(e.target.value)} placeholder="Type chassis number" />
          </div>
          <div className="bm-field-group">
            <label>Engine / Bike ID</label>
            <input className="bm-input" value={filters.search} onChange={(e) => setFilter("search")(e.target.value)} placeholder="Search engine no or bike ID" />
          </div>
        </div>
        <div className="bm-filter-actions">
          <button type="button" className="btn-outline" onClick={clearFilters}>Reset Filters</button>
        </div>
      </div>

      <div className="bm-table-card">
        {loadError && <div className="bm-alert bm-alert-error">{loadError}</div>}
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }} />
                <th>Brand</th>
                <th>Model</th>
                <th>Available</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="bm-table-empty">Loading…</td></tr>
              )}
              {!loading && groups.length === 0 && (
                <tr><td colSpan={6} className="bm-table-empty">No bikes in stock. Add your first bike!</td></tr>
              )}
              {!loading && pagedGroups.map((g) => (
                <GroupRow key={`${g.brandId}_${g.modelId}`} group={g} token={token} onRefresh={load} />
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={groups.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {showAdd && (
        <AddBikeModal
          token={token} brands={brands} suppliers={suppliers} colors={colors} fileNos={fileNos}
          onClose={() => setShowAdd(false)} onRefresh={load}
          onBrandAdded={(b) => setBrands((prev) => [...prev, b].sort((a, z) => a.name.localeCompare(z.name)))}
          onColorAdded={(c) => setColors((prev) => [...prev, c].sort((a, z) => a.name.localeCompare(z.name)))}
          onSupplierAdded={(supplier) => setSuppliers((prev) => [...prev, supplier].sort((a, z) => a.name.localeCompare(z.name)))}
        />
      )}
    </div>
  );
}
