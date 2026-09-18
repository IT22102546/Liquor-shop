"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { exportTableToPdf } from "../../lib/pdf-export";
import { IconActivity, IconInventory, IconInvoice, IconSupplier } from "../../lib/icons";
import CustomerPurchaseModal from "../../components/CustomerPurchaseModal";
import TablePagination, { paginateRows } from "../../components/TablePagination";

type ProductBrand = { id: number; name: string; _count?: { products: number } };
type ProductCategory = {
  id: number;
  name: string;
  _count?: { products: number };
};
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
type ProductImage = {
  id: number;
  productId: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
};
type ProductExpense = {
  id?: number;
  description: string;
  amount: number;
  createdAt?: string;
};
type Product = {
  id: number;
  displayId: string;
  name: string;
  partNumber?: string | null;
  compatibleWith?: string | null;
  brandId: number;
  categoryId: number;
  supplier?: { id: number; name: string; code: string } | null;
  brand: { id: number; name: string };
  category: { id: number; name: string };
  quantity: number;
  soldQuantity: number;
  lowStockThreshold?: number | null;
  lastSoldAt?: string | null;
  purchasePrice?: number;
  taxPaid?: number;
  additionalExpenses?: number;
  sellingPrice?: number;
  description?: string;
  expenses?: ProductExpense[];
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

const MAX_PRODUCT_IMAGES = 3;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 30 * 1024 * 1024;
const EMPTY_SUPPLIER_FORM: SupplierFormState = {
  name: "",
  contactPerson: "",
  telephone: "",
  address: "",
  fax: "",
  email: "",
  vatRegistrationNo: "",
};

function parseDescriptionPoints(value?: string) {
  const points = (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);

  return points.length > 0 ? points : [""];
}

function getProductPricingUnitCount(
  product?: Pick<Product, "quantity" | "soldQuantity"> | null,
) {
  const totalUnits = (product?.quantity ?? 0) + (product?.soldQuantity ?? 0);
  return totalUnits > 0 ? totalUnits : 1;
}

function formatCurrency(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Rs. 0.00";
  }

  return `Rs. ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDisplayDescriptionPoints(value?: string) {
  const normalized = (value ?? "")
    .replace(/\r/g, "")
    .replace(/\s*•\s*/g, "\n• ");

  return normalized
    .split("\n")
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);
}

function SelectWithAdd<T extends { id: number; name: string }>({
  value,
  onChange,
  options,
  placeholder,
  onAdd,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: T[];
  placeholder?: string;
  onAdd?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="bm-select-row">
      <select
        className="bm-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder ?? "Select..."}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {onAdd && (
        <button
          type="button"
          className="bm-plus-btn"
          onClick={onAdd}
          title="Add new"
        >
          +
        </button>
      )}
    </div>
  );
}

function ProductImageUploader({
  images,
  onChange,
  onError,
}: {
  images: File[];
  onChange: (files: File[]) => void;
  onError?: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = MAX_PRODUCT_IMAGES - images.length;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    const candidates = Array.from(fileList).slice(0, remaining);

    if (candidates.some((file) => !allowed.includes(file.type))) {
      onError?.("Only JPEG, PNG, WebP, and AVIF images are allowed");
      return;
    }
    if (candidates.some((file) => file.size > MAX_IMAGE_SIZE_BYTES)) {
      onError?.("Each image must be 10MB or smaller");
      return;
    }
    const totalBytes = [...images, ...candidates].reduce(
      (sum, file) => sum + file.size,
      0,
    );
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      onError?.("Total selected image size cannot exceed 30MB");
      return;
    }
    if (candidates.length > 0) onChange([...images, ...candidates]);
  };

  return (
    <div className="bm-img-uploader">
      <div className="bm-img-grid">
        {images.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className={`bm-img-thumb${index === 0 ? " bm-img-primary" : ""}`}
          >
            <img src={URL.createObjectURL(file)} alt={`Upload ${index + 1}`} />
            {index === 0 && <span className="bm-img-badge">Primary</span>}
            <button
              type="button"
              className="bm-img-remove"
              onClick={() => onChange(images.filter((_, idx) => idx !== index))}
            >
              ✕
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            className="bm-img-add-btn"
            onClick={() => inputRef.current?.click()}
          >
            <span className="bm-img-add-icon">📷</span>
            <span className="bm-img-add-text">
              {images.length === 0
                ? "Add Images"
                : `Add More (${remaining} left)`}
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple={remaining > 1}
        style={{ display: "none" }}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <p className="bm-img-hint">
        Maximum 3 images, first image will be primary.
      </p>
    </div>
  );
}

function SupplierQuickAddModal({
  token,
  onClose,
  onCreated,
  onAuthExpired,
}: {
  token: string;
  onClose: () => void;
  onCreated: (supplier: Supplier) => void;
  onAuthExpired: () => void;
}) {
  const [form, setForm] = useState<SupplierFormState>(EMPTY_SUPPLIER_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  const setField =
    (key: keyof SupplierFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
    };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
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
      const payload = (await response.json()) as {
        data?: Supplier;
        message?: string;
      };
      if (response.status === 401 || response.status === 403) {
        setError("Session expired. Please sign in again.");
        window.setTimeout(onAuthExpired, 800);
        return;
      }
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
      <div
        className="bm-modal bm-modal-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="bm-modal-close" onClick={onClose}>
          ✕
        </button>
        <h3 className="bm-modal-title">Add Supplier</h3>
        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <form className="bm-modal-form" onSubmit={submit}>
          <div className="bm-field-group">
            <label>Supplier Code</label>
            <input
              className="bm-input"
              value="Auto generated on save"
              disabled
            />
          </div>
          <div className="bm-field-group">
            <label>Supplier Name *</label>
            <input
              className="bm-input"
              value={form.name}
              onChange={setField("name")}
              required
            />
          </div>
          <div className="bm-field-group">
            <label>Contact Person</label>
            <input
              className="bm-input"
              value={form.contactPerson}
              onChange={setField("contactPerson")}
            />
          </div>
          <div className="bm-field-group">
            <label>Telephone</label>
            <input
              className="bm-input"
              value={form.telephone}
              onChange={setField("telephone")}
            />
          </div>
          <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
            <label>Address</label>
            <textarea
              className="bm-input"
              rows={3}
              value={form.address}
              onChange={setField("address")}
            />
          </div>
          <div className="bm-field-group">
            <label>Fax</label>
            <input
              className="bm-input"
              value={form.fax}
              onChange={setField("fax")}
            />
          </div>
          <div className="bm-field-group">
            <label>Email</label>
            <input
              className="bm-input"
              value={form.email}
              onChange={setField("email")}
            />
          </div>
          <div className="bm-field-group">
            <label>VAT Registration No</label>
            <input
              className="bm-input"
              value={form.vatRegistrationNo}
              onChange={setField("vatRegistrationNo")}
            />
          </div>
          <div className="bm-modal-actions">
            <button type="button" className="btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-accent"
              disabled={saving || !form.name.trim()}
            >
              {saving ? "Saving..." : "Save Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductModal({
  token,
  brands,
  categories,
  suppliers,
  product,
  onClose,
  onSaved,
  onBrandCreated,
  onCategoryCreated,
  onSupplierCreated,
  onAuthExpired,
}: {
  token: string;
  brands: ProductBrand[];
  categories: ProductCategory[];
  suppliers: Supplier[];
  product?: Product | null;
  onClose: () => void;
  onSaved: () => void;
  onBrandCreated: (brand: ProductBrand) => void;
  onCategoryCreated: (category: ProductCategory) => void;
  onSupplierCreated: (supplier: Supplier) => void;
  onAuthExpired: () => void;
}) {
  const isEdit = !!product;
  const initialPricingUnitCount = getProductPricingUnitCount(product);
  const [form, setForm] = useState({
    brandId: product?.brandId ? String(product.brandId) : "",
    categoryId: product?.categoryId ? String(product.categoryId) : "",
    supplierId: product?.supplier?.id ? String(product.supplier.id) : "",
    name: product?.name ?? "",
    partNumber: product?.partNumber ?? "",
    compatibleWith: product?.compatibleWith ?? "",
    quantity: String(product?.quantity ?? 0),
    lowStockThreshold:
      product?.lowStockThreshold != null
        ? String(product.lowStockThreshold)
        : "",
    purchasePrice:
      product?.purchasePrice != null
        ? String(product.purchasePrice * initialPricingUnitCount)
        : "",
    taxPaid:
      product?.taxPaid != null
        ? String(product.taxPaid * initialPricingUnitCount)
        : "",
    sellingPrice:
      product?.sellingPrice != null ? String(product.sellingPrice) : "",
  });
  const [descriptionPoints, setDescriptionPoints] = useState<string[]>(() =>
    parseDescriptionPoints(product?.description),
  );
  const [lowStockEnabled, setLowStockEnabled] = useState(
    (product?.lowStockThreshold ?? 0) > 0,
  );
  const [expenses, setExpenses] = useState<
    { description: string; amount: string }[]
  >(() => {
    if (product?.expenses?.length) {
      return product.expenses.map((expense) => ({
        description: expense.description,
        amount: String(expense.amount * initialPricingUnitCount),
      }));
    }
    if (product?.additionalExpenses != null && product.additionalExpenses > 0) {
      return [
        {
          description: "",
          amount: String(product.additionalExpenses * initialPricingUnitCount),
        },
      ];
    }
    return [];
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  const setField = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const setEvent =
    (key: keyof typeof form) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setField(key)(event.target.value);
  const totalAdditionalExpenses = expenses.reduce(
    (sum, expense) => sum + (Number(expense.amount) || 0),
    0,
  );
  const enteredQuantity = Number(form.quantity || 0);
  const pricingUnitCount = isEdit
    ? enteredQuantity + (product?.soldQuantity ?? 0)
    : enteredQuantity;
  const getPerPieceValue = (value: string) => {
    if (pricingUnitCount <= 0) return undefined;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return undefined;
    return numericValue / pricingUnitCount;
  };
  const perPiecePurchasePrice = getPerPieceValue(form.purchasePrice);
  const perPieceTaxPaid = getPerPieceValue(form.taxPaid);
  const perPieceAdditionalExpenses =
    pricingUnitCount > 0 && totalAdditionalExpenses > 0
      ? totalAdditionalExpenses / pricingUnitCount
      : undefined;

  const saveBrand = async () => {
    if (!newBrand.trim()) return;
    const response = await fetch(`${base}/product-brands`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBrand.trim() }),
    });
    const payload = (await response.json()) as {
      data?: ProductBrand;
      message?: string;
    };
    if (!response.ok || !payload.data) {
      setError(payload.message ?? "Failed to add brand");
      return;
    }
    onBrandCreated(payload.data);
    setField("brandId")(String(payload.data.id));
    setNewBrand("");
    setAddingBrand(false);
  };

  const saveCategory = async () => {
    if (!newCategory.trim()) return;
    const response = await fetch(`${base}/product-categories`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategory.trim() }),
    });
    const payload = (await response.json()) as {
      data?: ProductCategory;
      message?: string;
    };
    if (!response.ok || !payload.data) {
      setError(payload.message ?? "Failed to add category");
      return;
    }
    onCategoryCreated(payload.data);
    setField("categoryId")(String(payload.data.id));
    setNewCategory("");
    setAddingCategory(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.brandId || !form.categoryId || !form.name.trim()) {
      setError("Brand, category and product name are required.");
      return;
    }
    if (
      lowStockEnabled &&
      (!form.lowStockThreshold.trim() || Number(form.lowStockThreshold) <= 0)
    ) {
      setError("Enter a stock count greater than 0 for the low stock alert.");
      return;
    }

    const validDescriptionPoints = descriptionPoints
      .map((point) => point.trim())
      .filter(Boolean);
    const validExpenses = expenses
      .filter((expense) => expense.description.trim() && expense.amount)
      .map((expense) => ({
        description: expense.description.trim(),
        amount: Number(expense.amount),
      }));

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        isEdit ? `${base}/products/${product?.id}` : `${base}/products`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId: Number(form.brandId),
            categoryId: Number(form.categoryId),
            supplierId: form.supplierId ? Number(form.supplierId) : undefined,
            name: form.name.trim(),
            partNumber: form.partNumber.trim() || undefined,
            compatibleWith: form.compatibleWith.trim() || undefined,
            quantity: Number(form.quantity || 0),
            lowStockThreshold:
              lowStockEnabled && form.lowStockThreshold.trim() !== ""
                ? Number(form.lowStockThreshold)
                : 0,
            purchasePrice: form.purchasePrice
              ? Number(form.purchasePrice)
              : undefined,
            taxPaid: form.taxPaid ? Number(form.taxPaid) : undefined,
            additionalExpenses:
              validExpenses.length > 0
                ? validExpenses.reduce(
                    (sum, expense) => sum + expense.amount,
                    0,
                  )
                : undefined,
            sellingPrice: form.sellingPrice
              ? Number(form.sellingPrice)
              : undefined,
            description:
              validDescriptionPoints.length > 0
                ? validDescriptionPoints.map((point) => `• ${point}`).join("\n")
                : undefined,
            descriptionPoints:
              validDescriptionPoints.length > 0
                ? validDescriptionPoints
                : undefined,
            expenses: validExpenses.length > 0 ? validExpenses : undefined,
          }),
        },
      );
      const payload = (await response.json()) as {
        data?: Product;
        message?: string;
      };
      if (response.status === 401 || response.status === 403) {
        setError("Session expired. Please sign in again.");
        window.setTimeout(onAuthExpired, 800);
        return;
      }
      if (!response.ok || !payload.data) {
        setError(payload.message ?? "Failed to save product");
        return;
      }

      if (imageFiles.length > 0) {
        const formData = new FormData();
        imageFiles.forEach((file) => formData.append("images", file));
        const imgResponse = await fetch(
          `${base}/products/${payload.data.id}/images`,
          {
            method: "POST",
            headers: auth,
            body: formData,
          },
        );
        if (!imgResponse.ok) {
          const imgPayload = (await imgResponse.json().catch(() => null)) as {
            message?: string;
          } | null;
          setError(
            imgPayload?.message ?? "Product saved, but image upload failed",
          );
          onSaved();
          return;
        }
      }

      onSaved();
      onClose();
    } catch {
      setError("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div
        className="bm-modal bm-view-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="bm-modal-close" onClick={onClose}>
          ✕
        </button>
        <h3 className="bm-modal-title">
          {isEdit
            ? `Edit Spare Part — ${product?.displayId}`
            : "Add Spare Part"}
        </h3>
        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <form className="bm-modal-form" onSubmit={submit}>
          <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
            <label>Product Images (max 3)</label>
            <ProductImageUploader
              images={imageFiles}
              onChange={setImageFiles}
              onError={setError}
            />
          </div>

          <div className="bm-fields-grid">
            <div className="bm-field-group">
              <label>Brand *</label>
              <SelectWithAdd
                value={form.brandId}
                onChange={setField("brandId")}
                options={brands}
                placeholder="Select brand"
                onAdd={() => setAddingBrand(true)}
              />
              {addingBrand && (
                <div className="bm-quick-add-row">
                  <input
                    className="bm-input bm-input-sm"
                    value={newBrand}
                    onChange={(event) => setNewBrand(event.target.value)}
                    placeholder="New brand"
                  />
                  <button
                    type="button"
                    className="btn-accent bm-add-btn"
                    onClick={saveBrand}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="bm-action-btn bm-cancel-btn"
                    onClick={() => setAddingBrand(false)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="bm-field-group">
              <label>Category *</label>
              <SelectWithAdd
                value={form.categoryId}
                onChange={setField("categoryId")}
                options={categories}
                placeholder="Select category"
                onAdd={() => setAddingCategory(true)}
              />
              {addingCategory && (
                <div className="bm-quick-add-row">
                  <input
                    className="bm-input bm-input-sm"
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    placeholder="New category"
                  />
                  <button
                    type="button"
                    className="btn-accent bm-add-btn"
                    onClick={saveCategory}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="bm-action-btn bm-cancel-btn"
                    onClick={() => setAddingCategory(false)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="bm-field-group">
              <label>Supplier</label>
              <SelectWithAdd
                value={form.supplierId}
                onChange={setField("supplierId")}
                options={suppliers}
                placeholder="Select supplier"
                onAdd={() => setShowSupplierModal(true)}
              />
            </div>

            <div className="bm-field-group">
              <label>Spare Part Name *</label>
              <input
                className="bm-input"
                value={form.name}
                onChange={setEvent("name")}
                placeholder="Enter product / spare part name"
              />
            </div>

            <div className="bm-field-group">
              <label>Part Number / OEM Code</label>
              <input
                className="bm-input"
                value={form.partNumber}
                onChange={setEvent("partNumber")}
                placeholder="e.g. YZF-R15-CAM-001"
              />
            </div>

            <div className="bm-field-group">
              <label>Drink Style / Serving Notes</label>
              <input
                className="bm-input"
                value={form.compatibleWith}
                onChange={setEvent("compatibleWith")}
                placeholder="e.g. Yamaha R15 V3, Yamaha MT-15"
              />
            </div>

            <div className="bm-field-group">
              <label>Quantity / Pieces *</label>
              <input
                className="bm-input"
                type="number"
                min={0}
                value={form.quantity}
                onChange={setEvent("quantity")}
                placeholder="0"
              />
              {pricingUnitCount <= 0 && (
                <span style={{ fontSize: 12, color: "var(--text-soft)" }}>
                  Enter the number of pieces to preview the per-piece cost.
                </span>
              )}
            </div>

            <div className="bm-field-group">
              <label>Low Stock Alert</label>
              <div style={{ display: "grid", gap: 8 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "var(--text-soft)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={lowStockEnabled}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setLowStockEnabled(enabled);
                      if (!enabled) setField("lowStockThreshold")("");
                    }}
                  />
                  Enable low stock alert for this product
                </label>
                {lowStockEnabled && (
                  <input
                    className="bm-input"
                    type="number"
                    min={1}
                    value={form.lowStockThreshold}
                    onChange={setEvent("lowStockThreshold")}
                    placeholder="Show alert when stock reaches this number"
                  />
                )}
              </div>
            </div>

            <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 12, color: "var(--text-soft)" }}>
                Enter purchase price, tax, and additional expenses as the total
                for the full stock set. The system will divide and save the
                per-piece cost automatically, while selling price stays per
                piece.
                {pricingUnitCount > 0
                  ? ` Current pricing batch: ${pricingUnitCount} piece${pricingUnitCount > 1 ? "s" : ""}.`
                  : ""}
              </span>
            </div>

            <div className="bm-field-group">
              <label>Selling Price (per piece)</label>
              <input
                className="bm-input"
                type="number"
                min={0}
                step="0.01"
                value={form.sellingPrice}
                onChange={setEvent("sellingPrice")}
                placeholder="e.g. 4500"
              />
            </div>

            <div className="bm-field-group">
              <label>Purchase Price (total for all pieces)</label>
              <input
                className="bm-input"
                type="number"
                min={0}
                step="0.01"
                value={form.purchasePrice}
                onChange={setEvent("purchasePrice")}
                placeholder="e.g. 3000 for the full stock set"
              />
              {perPiecePurchasePrice !== undefined && (
                <span style={{ fontSize: 12, color: "var(--text-soft)" }}>
                  Per piece: {formatCurrency(perPiecePurchasePrice)}
                </span>
              )}
            </div>

            <div className="bm-field-group">
              <label>Tax Paid (total for all pieces)</label>
              <input
                className="bm-input"
                type="number"
                min={0}
                step="0.01"
                value={form.taxPaid}
                onChange={setEvent("taxPaid")}
                placeholder="e.g. 250 for the full stock set"
              />
              {perPieceTaxPaid !== undefined && (
                <span style={{ fontSize: 12, color: "var(--text-soft)" }}>
                  Per piece: {formatCurrency(perPieceTaxPaid)}
                </span>
              )}
            </div>

            <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <label style={{ margin: 0 }}>Description Points</label>
                <button
                  type="button"
                  className="btn-accent bm-add-btn"
                  onClick={() => setDescriptionPoints((prev) => [...prev, ""])}
                >
                  +
                </button>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {descriptionPoints.map((point, index) => (
                  <div key={`point-${index}`} className="bm-quick-add-row">
                    <input
                      className="bm-input"
                      value={point}
                      onChange={(event) =>
                        setDescriptionPoints((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder={`Description point ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="bm-action-btn bm-del-btn"
                      onClick={() =>
                        setDescriptionPoints((prev) =>
                          prev.length === 1
                            ? [""]
                            : prev.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                        )
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <label style={{ margin: 0 }}>
                  Additional Expenses (total for all pieces)
                  {expenses.length > 0 && (
                    <span
                      style={{
                        fontWeight: 400,
                        fontSize: 12,
                        color: "var(--text-soft)",
                      }}
                    >
                      {` (Batch total: ${formatCurrency(totalAdditionalExpenses)}${perPieceAdditionalExpenses !== undefined ? ` · Per piece: ${formatCurrency(perPieceAdditionalExpenses)}` : ""})`}
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  className="btn-accent bm-add-btn"
                  onClick={() =>
                    setExpenses((prev) => [
                      ...prev,
                      { description: "", amount: "" },
                    ])
                  }
                >
                  +
                </button>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {expenses.map((expense, index) => (
                  <div key={`expense-${index}`} className="bm-quick-add-row">
                    <input
                      className="bm-input"
                      value={expense.description}
                      onChange={(event) =>
                        setExpenses((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, description: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Expense description"
                    />
                    <input
                      className="bm-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={expense.amount}
                      onChange={(event) =>
                        setExpenses((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, amount: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Total amount"
                      style={{ maxWidth: 160 }}
                    />
                    <button
                      type="button"
                      className="bm-action-btn bm-del-btn"
                      onClick={() =>
                        setExpenses((prev) =>
                          prev.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {expenses.length === 0 && (
                  <span style={{ color: "var(--text-soft)", fontSize: 13 }}>
                    Press + to add an expense row. Enter each amount as the
                    total for the full stock set.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bm-modal-actions">
            <button type="button" className="btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-accent" disabled={saving}>
              {saving
                ? "Saving..."
                : isEdit
                  ? "Update Product"
                  : "Save Product"}
            </button>
          </div>
        </form>
      </div>

      {showSupplierModal && (
        <SupplierQuickAddModal
          token={token}
          onClose={() => setShowSupplierModal(false)}
          onCreated={onSupplierCreated}
          onAuthExpired={onAuthExpired}
        />
      )}
    </div>
  );
}

function RecordSaleModal({
  product,
  token,
  onClose,
  onSaved,
}: {
  product: Product;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <CustomerPurchaseModal
      token={token}
      itemType="INVENTORY"
      itemId={product.id}
      itemLabel={`${product.displayId} | ${product.name} (${product.brand.name})`}
      currentSellingPrice={product.sellingPrice}
      maxQuantity={product.quantity}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function ViewProductModal({
  product,
  token,
  onClose,
}: {
  product: Product;
  token: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Product>(product);
  const [images, setImages] = useState<ProductImage[]>(product.images ?? []);
  const [loading, setLoading] = useState(true);
  const pricingUnitCount = getProductPricingUnitCount(detail);
  const descriptionPoints = getDisplayDescriptionPoints(detail.description);
  const expenseBreakdown = (
    (detail.expenses ?? []).length > 0
      ? (detail.expenses ?? [])
      : detail.additionalExpenses != null && detail.additionalExpenses > 0
        ? [
            {
              description: "Additional expense",
              amount: detail.additionalExpenses,
            },
          ]
        : []
  ).map((expense) => ({
    ...expense,
    description: expense.description?.trim() || "Additional expense",
  }));
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
          const payload = (await productResponse.json()) as { data: Product };
          setDetail(payload.data);
        }
        if (imageResponse.ok) {
          const payload = (await imageResponse.json()) as {
            data: ProductImage[];
          };
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
      <div
        className="bm-modal bm-view-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="bm-modal-close" onClick={onClose}>
          ✕
        </button>
        <h3 className="bm-modal-title">Product Details — {detail.displayId}</h3>
        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: 12,
              color: "var(--text-soft)",
            }}
          >
            Loading product details…
          </div>
        )}
        <div className="bm-view-layout">
          <div className="bm-view-left">
            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Images</h4>
              {images.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: 10,
                  }}
                >
                  {images.map((image) => (
                    <img
                      key={image.id}
                      src={`${API_URL}${image.url}`}
                      alt="Product"
                      className="bm-row-thumb"
                      style={{
                        width: "100%",
                        height: 120,
                        borderRadius: 10,
                        objectFit: "cover",
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="bm-gallery-empty">
                  <span className="bm-gallery-empty-icon">🖼️</span>
                  <span>No images available</span>
                </div>
              )}
            </div>
            <div className="bm-view-quick-info">
              <div className="bm-view-quick-item">
                <span className="bm-view-quick-label">Brand</span>
                <span className="bm-view-quick-value">{detail.brand.name}</span>
              </div>
              <div className="bm-view-quick-item">
                <span className="bm-view-quick-label">Category</span>
                <span className="bm-view-quick-value">
                  {detail.category.name}
                </span>
              </div>
              <div className="bm-view-quick-item">
                <span className="bm-view-quick-label">Supplier</span>
                <span className="bm-view-quick-value">
                  {detail.supplier
                    ? `${detail.supplier.name} (${detail.supplier.code})`
                    : "—"}
                </span>
              </div>
              <div className="bm-view-quick-item">
                <span className="bm-view-quick-label">In Stock</span>
                <span className="bm-view-quick-value">{detail.quantity}</span>
              </div>
              <div className="bm-view-quick-item">
                <span className="bm-view-quick-label">Low Stock Alert</span>
                <span className="bm-view-quick-value">
                  {detail.lowStockThreshold != null
                    ? detail.lowStockThreshold
                    : "Not set"}
                </span>
              </div>
              <div className="bm-view-quick-item">
                <span className="bm-view-quick-label">Sold</span>
                <span className="bm-view-quick-value">
                  {detail.soldQuantity ?? 0}
                </span>
              </div>
              <div className="bm-view-quick-item">
                <span className="bm-view-quick-label">Last Sold</span>
                <span className="bm-view-quick-value">
                  {detail.lastSoldAt
                    ? new Date(detail.lastSoldAt).toLocaleString()
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="bm-view-right">
            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Spare Part Information</h4>
              <div className="bm-view-detail-grid">
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">Part Name</span>
                  <span className="bm-view-detail-value">{detail.name}</span>
                </div>
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">Part Number</span>
                  <span className="bm-view-detail-value">
                    {detail.partNumber ?? "—"}
                  </span>
                </div>
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">Compatible With</span>
                  <span className="bm-view-detail-value">
                    {detail.compatibleWith ?? "—"}
                  </span>
                </div>
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">Created At</span>
                  <span className="bm-view-detail-value">
                    {new Date(detail.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="bm-view-desc">
                <span className="bm-view-detail-label">Description Points</span>
                {descriptionPoints.length > 0 ? (
                  <ul
                    className="bm-view-desc-text"
                    style={{ margin: "0.5rem 0 0 1rem" }}
                  >
                    {descriptionPoints.map((line, index) => (
                      <li key={`${line}-${index}`}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <div
                    style={{
                      marginTop: 8,
                      color: "var(--text-soft)",
                      fontSize: 13,
                    }}
                  >
                    No description points added for this product.
                  </div>
                )}
              </div>
            </div>

            <div className="bm-view-section">
              <h4 className="bm-view-section-title">Pricing</h4>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 12,
                  color: "var(--text-soft)",
                }}
              >
                Purchase price, tax, and extra expenses are shown as the
                per-piece cost for this stock batch ({pricingUnitCount} piece
                {pricingUnitCount > 1 ? "s" : ""}).
              </p>
              <div className="bm-view-detail-grid">
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">Purchase Price </span>
                  <span className="bm-view-detail-value bm-view-price">
                    {detail.purchasePrice != null
                      ? formatCurrency(detail.purchasePrice)
                      : "—"}
                  </span>
                </div>
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">Tax Paid</span>
                  <span className="bm-view-detail-value bm-view-price">
                    {detail.taxPaid != null
                      ? formatCurrency(detail.taxPaid)
                      : "—"}
                  </span>
                </div>
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">
                    Additional Expenses
                  </span>
                  <span className="bm-view-detail-value bm-view-price">
                    {detail.additionalExpenses != null
                      ? formatCurrency(detail.additionalExpenses)
                      : "—"}
                  </span>
                </div>
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">
                    Selling Price / Piece
                  </span>
                  <span className="bm-view-detail-value bm-view-price bm-view-price-highlight">
                    {detail.sellingPrice != null
                      ? formatCurrency(detail.sellingPrice)
                      : "—"}
                  </span>
                </div>
              </div>
              {expenseBreakdown.length > 0 && (
                <div className="bm-view-desc">
                  <span className="bm-view-detail-label">
                    Additional Expense Breakdown
                  </span>
                  <div
                    className="bm-view-expenses-table"
                    style={{ marginTop: 10 }}
                  >
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{ textAlign: "left", padding: "6px 10px" }}
                          >
                            Expense Description
                          </th>
                          <th
                            style={{ textAlign: "right", padding: "6px 10px" }}
                          >
                            Price
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseBreakdown.map((expense, index) => (
                          <tr key={`${expense.description}-${index}`}>
                            <td style={{ padding: "6px 10px" }}>
                              {expense.description}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 10px",
                              }}
                            >
                              {formatCurrency(expense.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr
                          style={{
                            fontWeight: 700,
                            borderTop: "1px solid var(--panel-border)",
                          }}
                        >
                          <td style={{ padding: "6px 10px" }}>Total</td>
                          <td
                            style={{ textAlign: "right", padding: "6px 10px" }}
                          >
                            {formatCurrency(
                              expenseBreakdown.reduce(
                                (sum, expense) => sum + expense.amount,
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="bm-modal-actions">
          <button type="button" className="btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { token, logout } = useAdmin();
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [saleProduct, setSaleProduct] = useState<Product | null>(null);
  const [alertProduct, setAlertProduct] = useState<Product | null>(null);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState("");
  const [savingAlert, setSavingAlert] = useState(false);

  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const searchParam = search.trim()
        ? `&search=${encodeURIComponent(search.trim())}`
        : "";
      const [
        brandResponse,
        categoryResponse,
        supplierResponse,
        productResponse,
      ] = await Promise.all([
        fetch(`${base}/product-brands`, { headers: auth }),
        fetch(`${base}/product-categories`, { headers: auth }),
        fetch(`${base}/suppliers`, { headers: auth }),
        fetch(`${base}/products?limit=5000${searchParam}`, { headers: auth }),
      ]);

      const [brandPayload, categoryPayload, supplierPayload, productPayload] =
        (await Promise.all([
          brandResponse.json(),
          categoryResponse.json(),
          supplierResponse.json(),
          productResponse.json(),
        ])) as [
          { data?: ProductBrand[]; message?: string },
          { data?: ProductCategory[]; message?: string },
          { data?: Supplier[]; message?: string },
          { data?: { products?: Product[] }; message?: string },
        ];

      if (
        [
          brandResponse.status,
          categoryResponse.status,
          supplierResponse.status,
          productResponse.status,
        ].some((status) => status === 401 || status === 403)
      ) {
        logout();
        throw new Error("Session expired. Please sign in again.");
      }

      if (!brandResponse.ok)
        throw new Error(brandPayload.message ?? "Failed to load brands");
      if (!categoryResponse.ok)
        throw new Error(categoryPayload.message ?? "Failed to load categories");
      if (!supplierResponse.ok)
        throw new Error(supplierPayload.message ?? "Failed to load suppliers");
      if (!productResponse.ok)
        throw new Error(productPayload.message ?? "Failed to load products");

      setBrands(brandPayload.data ?? []);
      setCategories(categoryPayload.data ?? []);
      setSuppliers(supplierPayload.data ?? []);
      setProducts(productPayload.data?.products ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load inventory data",
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const groupedProducts = useMemo(() => {
    const sortedProducts = [...products].sort((left, right) => {
      const byCategory = left.category.name.localeCompare(right.category.name);
      if (byCategory !== 0) return byCategory;
      const byBrand = left.brand.name.localeCompare(right.brand.name);
      if (byBrand !== 0) return byBrand;
      return left.name.localeCompare(right.name);
    });

    const groups = new Map<
      number,
      { categoryName: string; products: Product[]; brandIds: Set<number> }
    >();
    for (const product of sortedProducts) {
      const current = groups.get(product.category.id) ?? {
        categoryName: product.category.name,
        products: [],
        brandIds: new Set<number>(),
      };
      current.products.push(product);
      current.brandIds.add(product.brand.id);
      groups.set(product.category.id, current);
    }

    return Array.from(groups.entries()).map(([categoryId, group]) => ({
      categoryId,
      categoryName: group.categoryName,
      count: group.products.length,
      brandCount: group.brandIds.size,
      totalQty: group.products.reduce(
        (sum, product) => sum + product.quantity,
        0,
      ),
      soldQty: group.products.reduce(
        (sum, product) => sum + (product.soldQuantity ?? 0),
        0,
      ),
      supplierCount: group.products.filter((product) => product.supplier)
        .length,
      lowStockCount: group.products.filter(
        (product) =>
          (product.lowStockThreshold ?? 0) > 0 &&
          product.quantity <= (product.lowStockThreshold ?? 0),
      ).length,
      products: group.products,
    }));
  }, [products]);
  const pagedProductGroups = useMemo(() => paginateRows(groupedProducts, page, pageSize), [groupedProducts, page, pageSize]);
  useEffect(() => { setPage(1); }, [search, pageSize]);

  const totalQty = products.reduce((sum, product) => sum + product.quantity, 0);
  const totalSoldQty = products.reduce(
    (sum, product) => sum + (product.soldQuantity ?? 0),
    0,
  );
  const soldProductCount = products.filter(
    (product) => (product.soldQuantity ?? 0) > 0,
  ).length;
  const lowStockProducts = products.filter(
    (product) =>
      (product.lowStockThreshold ?? 0) > 0 &&
      product.quantity <= (product.lowStockThreshold ?? 0),
  );
  const lowStockCount = lowStockProducts.length;

  const exportInventoryPdf = () => {
    exportTableToPdf({
      fileName: "inventory-available-report",
      title: "Inventory Available Report",
      subtitle: "All inventory items currently loaded in Inventory tab",
      rows: products,
      columns: [
        { header: "Display ID", value: (product) => product.displayId },
        { header: "Product Name", value: (product) => product.name },
        { header: "Category", value: (product) => product.category.name },
        { header: "Brand", value: (product) => product.brand.name },
        { header: "Supplier", value: (product) => product.supplier ? `${product.supplier.name} (${product.supplier.code})` : "-" },
        { header: "In Stock", value: (product) => product.quantity },
        { header: "Sold Qty", value: (product) => product.soldQuantity ?? 0 },
        { header: "Purchase Price", value: (product) => product.purchasePrice ?? "-" },
        { header: "Tax Paid", value: (product) => product.taxPaid ?? "-" },
        { header: "Additional Expenses", value: (product) => product.additionalExpenses ?? "-" },
        { header: "Selling Price", value: (product) => product.sellingPrice ?? "-" },
        { header: "Low Stock Threshold", value: (product) => product.lowStockThreshold ?? 0 },
        { header: "Last Sold At", value: (product) => product.lastSoldAt ? new Date(product.lastSoldAt).toLocaleString() : "-" },
        { header: "Description", value: (product) => product.description ?? "-" },
      ],
    });
  };

  const removeProduct = async (id: number) => {
    if (!window.confirm("Delete this inventory product?")) return;
    const response = await fetch(`${base}/products/${id}`, {
      method: "DELETE",
      headers: auth,
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(payload?.message ?? "Failed to delete product");
      return;
    }
    setProducts((current) => current.filter((product) => product.id !== id));
  };

  const openAlertEditor = (product: Product) => {
    setError(null);
    setAlertProduct(product);
    setAlertEnabled((product.lowStockThreshold ?? 0) > 0);
    setAlertThreshold(
      (product.lowStockThreshold ?? 0) > 0
        ? String(product.lowStockThreshold)
        : "",
    );
  };

  const saveAlertSettings = async () => {
    if (!alertProduct) return;
    if (
      alertEnabled &&
      (!alertThreshold.trim() || Number(alertThreshold) <= 0)
    ) {
      setError("Enter a stock count greater than 0 for the low stock alert.");
      return;
    }

    setSavingAlert(true);
    setError(null);
    try {
      const response = await fetch(`${base}/products/${alertProduct.id}`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          lowStockThreshold:
            alertEnabled && alertThreshold.trim() !== ""
              ? Number(alertThreshold)
              : 0,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        setError(payload?.message ?? "Failed to save low stock alert.");
        return;
      }
      setAlertProduct(null);
      await loadData();
    } catch {
      setError("Failed to save low stock alert.");
    } finally {
      setSavingAlert(false);
    }
  };

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon">
            <IconInventory />
          </div>
          <div>
            <h2 className="page-title">Drinks & Products</h2>
            <p className="page-subtitle">
              Track drinks by category and brand, record sold counts,
              manage part numbers and bike compatibility.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-accent"
          onClick={() => {
            setEditingProduct(null);
            setShowProductModal(true);
          }}
        >
          + Add Spare Part
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        <Link href="/dashboard/inventory" className="btn-accent">
          Drink Inventory
        </Link>
        <Link href="/dashboard/inventory/sold" className="btn-outline">
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
            <span className="bm-stat-label">Drinks & Products</span>
          </div>
          <strong className="bm-stat-value">{products.length}</strong>
          <span className="bm-stat-sub">Active bar products</span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head">
            <span className="bm-stat-icon">
              <IconInvoice />
            </span>
            <span className="bm-stat-label">In Stock</span>
          </div>
          <strong className="bm-stat-value">{totalQty}</strong>
          <span className="bm-stat-sub">Units currently available</span>
        </div>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head">
            <span className="bm-stat-icon">
              <IconActivity />
            </span>
            <span className="bm-stat-label">Sold Units</span>
          </div>
          <strong className="bm-stat-value">{totalSoldQty}</strong>
          <span className="bm-stat-sub">
            Across {soldProductCount} sold products
          </span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head">
            <span className="bm-stat-icon">
              <IconSupplier />
            </span>
            <span className="bm-stat-label">Low Stock</span>
          </div>
          <strong className="bm-stat-value">{lowStockCount}</strong>
          <span className="bm-stat-sub">Threshold-based alerts</span>
        </div>
      </div>

      <div className="bm-table-card">
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--panel-border)", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input className="bm-input" style={{ maxWidth: 420 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by product, category, brand, supplier or description" />
          <button type="button" className="btn-outline" onClick={() => void loadData()}>Refresh</button>
          <button type="button" className="btn-outline" onClick={exportInventoryPdf}>Export PDF</button>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 70 }} />
                <th>Category / Part</th>
                <th>Brand</th>
                <th>Part No.</th>
                <th>Supplier</th>
                <th>In Stock</th>
                <th>Sold</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="bm-table-empty">
                    Loading drinks and products...
                  </td>
                </tr>
              )}
              {!loading && groupedProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="bm-table-empty">
                    No drinks or products found.
                  </td>
                </tr>
              )}
              {!loading &&
                pagedProductGroups.map((group) => (
                  <Fragment key={group.categoryId}>
                    <tr className="bm-group-row">
                      <td>
                        <button
                          type="button"
                          className="bm-expand-btn"
                          onClick={() =>
                            setExpanded((current) => ({
                              ...current,
                              [group.categoryId]: !current[group.categoryId],
                            }))
                          }
                        >
                          <span
                            className={`bm-chevron ${expanded[group.categoryId] ? "open" : ""}`}
                          >
                            ⌄
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="bm-vehicle-detail">
                          {group.categoryName}
                        </span>
                        <span className="bm-vehicle-meta">
                          {group.count} parts in this category
                        </span>
                      </td>
                      <td>{group.brandCount} brands</td>
                      <td>—</td>
                      <td>{group.supplierCount} linked</td>
                      <td>{group.totalQty}</td>
                      <td>{group.soldQty}</td>
                      <td>
                        <span
                          className={`badge ${group.lowStockCount > 0 ? "badge-warning" : "badge-active"}`}
                        >
                          {group.lowStockCount > 0
                            ? `${group.lowStockCount} alert${group.lowStockCount > 1 ? "s" : ""}`
                            : "Healthy"}
                        </span>
                      </td>
                    </tr>
                    {expanded[group.categoryId] &&
                      group.products.map((product) => {
                        const primaryImg =
                          (product.images ?? []).find(
                            (image) => image.isPrimary,
                          ) ?? (product.images ?? [])[0];
                        return (
                          <tr key={product.id} className="bm-vehicle-row">
                            <td>
                              {primaryImg ? (
                                <img
                                  src={`${API_URL}${primaryImg.url}`}
                                  alt=""
                                  className="bm-row-thumb"
                                />
                              ) : (
                                <span className="bm-row-thumb-empty">🖼️</span>
                              )}
                            </td>
                            <td>
                              <span className="bm-vehicle-detail">
                                {product.name}
                              </span>
                              <span className="bm-vehicle-meta">
                                {product.displayId} · {product.category.name}
                              </span>
                            </td>
                            <td>{product.brand.name}</td>
                            <td>
                              {product.partNumber ? (
                                <code style={{ fontSize: 12 }}>
                                  {product.partNumber}
                                </code>
                              ) : (
                                <em className="bm-missing">—</em>
                              )}
                            </td>
                            <td>
                              {product.supplier ? (
                                `${product.supplier.name} (${product.supplier.code})`
                              ) : (
                                <em className="bm-missing">No supplier</em>
                              )}
                            </td>
                            <td>
                              <span
                                className={`badge ${(product.lowStockThreshold ?? 0) > 0 && product.quantity <= (product.lowStockThreshold ?? 0) ? "badge-warning" : "badge-active"}`}
                              >
                                {product.quantity}
                              </span>
                            </td>
                            <td>{product.soldQuantity ?? 0}</td>
                            <td>
                              <div className="bm-row-actions">
                                <button
                                  type="button"
                                  className="bm-action-btn bm-view-btn"
                                  onClick={() => setViewProduct(product)}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  className="bm-action-btn bm-save-btn"
                                  disabled={product.quantity <= 0}
                                  onClick={() => setSaleProduct(product)}
                                >
                                  Sell
                                </button>
                                <button
                                  type="button"
                                  className="bm-action-btn bm-edit-btn"
                                  onClick={() => openAlertEditor(product)}
                                >
                                  Alert
                                </button>
                                <button
                                  type="button"
                                  className="bm-action-btn bm-edit-btn"
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setShowProductModal(true);
                                  }}
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  className="bm-action-btn bm-del-btn"
                                  onClick={() => void removeProduct(product.id)}
                                >
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {expanded[group.categoryId] &&
                      alertProduct &&
                      group.products.some(
                        (product) => product.id === alertProduct.id,
                      ) && (
                        <tr>
                          <td colSpan={8}>
                            <div className="bm-inline-confirm bm-setting-panel">
                              <div className="bm-setting-panel-header">
                                <strong>
                                  {alertProduct.name} low stock setting
                                </strong>
                                <label className="bm-setting-toggle">
                                  <input
                                    type="checkbox"
                                    checked={alertEnabled}
                                    onChange={(event) => {
                                      setAlertEnabled(event.target.checked);
                                      if (!event.target.checked)
                                        setAlertThreshold("");
                                    }}
                                  />
                                  Enable alert
                                </label>
                              </div>
                              {alertEnabled && (
                                <input
                                  className="bm-input"
                                  style={{ maxWidth: 300 }}
                                  type="number"
                                  min={1}
                                  placeholder="Show alert when stock reaches this number"
                                  value={alertThreshold}
                                  onChange={(event) =>
                                    setAlertThreshold(event.target.value)
                                  }
                                />
                              )}
                              <div className="bm-setting-panel-actions">
                                <button
                                  type="button"
                                  className="btn-accent"
                                  onClick={() => void saveAlertSettings()}
                                  disabled={savingAlert}
                                >
                                  {savingAlert ? "Saving..." : "Save Alert"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-outline"
                                  onClick={() => setAlertProduct(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={groupedProducts.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {showProductModal && (
        <ProductModal
          token={token}
          brands={brands}
          categories={categories}
          suppliers={suppliers}
          product={editingProduct}
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
          onSaved={() => void loadData()}
          onBrandCreated={(brand) =>
            setBrands((current) =>
              [...current, brand].sort((left, right) =>
                left.name.localeCompare(right.name),
              ),
            )
          }
          onCategoryCreated={(category) =>
            setCategories((current) =>
              [...current, category].sort((left, right) =>
                left.name.localeCompare(right.name),
              ),
            )
          }
          onSupplierCreated={(supplier) =>
            setSuppliers((current) =>
              [...current, supplier].sort((left, right) =>
                left.name.localeCompare(right.name),
              ),
            )
          }
          onAuthExpired={logout}
        />
      )}

      {saleProduct && (
        <RecordSaleModal
          product={saleProduct}
          token={token}
          onClose={() => setSaleProduct(null)}
          onSaved={() => void loadData()}
        />
      )}
      {viewProduct && (
        <ViewProductModal
          product={viewProduct}
          token={token}
          onClose={() => setViewProduct(null)}
        />
      )}
    </div>
  );
}
