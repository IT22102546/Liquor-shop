"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { IconInventory } from "../../lib/icons";

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
type CartLine = { product: Product; quantity: number };
type CompletedReceipt = {
  invoiceNumber: string;
  lines: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  total: number;
  amountReceived: number;
  change: number;
  completedAt: string;
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function escapeReceiptText(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function printReceipt(receipt: CompletedReceipt) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  const rows = receipt.lines.map((line) => `
    <tr><td>${escapeReceiptText(line.name)}<br><small>${line.quantity} × Rs. ${line.unitPrice.toFixed(2)}</small></td><td>Rs. ${line.total.toFixed(2)}</td></tr>
  `).join("");
  frame.srcdoc = `<!doctype html><html><head><title>${escapeReceiptText(receipt.invoiceNumber)}</title><style>
    @page{size:80mm auto;margin:4mm}*{box-sizing:border-box}body{width:72mm;margin:0;font:12px Arial,sans-serif;color:#000}.center{text-align:center}h1{margin:0;font-size:18px}p{margin:3px 0}.rule{border-top:1px dashed #000;margin:9px 0}table{width:100%;border-collapse:collapse}td{padding:5px 0;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}.total{font-size:16px;font-weight:700}.summary{display:flex;justify-content:space-between;margin:5px 0}.thanks{margin-top:12px;font-weight:700}small{font-size:10px}
  </style></head><body><div class="center"><h1>BAR SHOP</h1><p>No:154, Puttalam Road, Kurunegala</p><p>${escapeReceiptText(receipt.invoiceNumber)}</p><p>${new Date(receipt.completedAt).toLocaleString()}</p></div><div class="rule"></div><table>${rows}</table><div class="rule"></div><div class="summary total"><span>TOTAL</span><span>Rs. ${receipt.total.toFixed(2)}</span></div><div class="summary"><span>Payment</span><span>${receipt.paymentMethod === "CASH" ? "Cash" : "Card / Transfer"}</span></div>${receipt.paymentMethod === "CASH" ? `<div class="summary"><span>Cash received</span><span>Rs. ${receipt.amountReceived.toFixed(2)}</span></div><div class="summary"><span>Change</span><span>Rs. ${receipt.change.toFixed(2)}</span></div>` : ""}<div class="rule"></div><p class="center thanks">Thank you!</p></body></html>`;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
  document.body.appendChild(frame);
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
            ? `Edit Product — ${product?.displayId}`
            : "Add Product"}
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
              <label>Product Name *</label>
              <input
                className="bm-input"
                value={form.name}
                onChange={setEvent("name")}
                placeholder="e.g. Lion Lager 330ml"
              />
            </div>

            <div className="bm-field-group">
              <label>SKU / Barcode</label>
              <input
                className="bm-input"
                value={form.partNumber}
                onChange={setEvent("partNumber")}
                placeholder="e.g. 4792021001234"
              />
            </div>

            <div className="bm-field-group">
              <label>Size / Serving Notes</label>
              <input
                className="bm-input"
                value={form.compatibleWith}
                onChange={setEvent("compatibleWith")}
                placeholder="e.g. 330ml bottle, serve chilled"
              />
            </div>

            <div className="bm-field-group">
              <label>Opening Stock *</label>
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
                  Enter the number of units to preview the cost per unit.
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
                per-unit cost automatically, while selling price stays per
                unit.
                {pricingUnitCount > 0
                  ? ` Current pricing batch: ${pricingUnitCount} unit${pricingUnitCount > 1 ? "s" : ""}.`
                  : ""}
              </span>
            </div>

            <div className="bm-field-group">
              <label>Selling Price (per unit)</label>
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
              <label>Purchase Price (batch total)</label>
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
                  Per unit: {formatCurrency(perPiecePurchasePrice)}
                </span>
              )}
            </div>

            <div className="bm-field-group">
              <label>Tax Paid (batch total)</label>
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
                  Per unit: {formatCurrency(perPieceTaxPaid)}
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
                  Additional Expenses (batch total)
                  {expenses.length > 0 && (
                    <span
                      style={{
                        fontWeight: 400,
                        fontSize: 12,
                        color: "var(--text-soft)",
                      }}
                    >
                      {` (Batch total: ${formatCurrency(totalAdditionalExpenses)}${perPieceAdditionalExpenses !== undefined ? ` · Per unit: ${formatCurrency(perPieceAdditionalExpenses)}` : ""})`}
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
              <h4 className="bm-view-section-title">Product Information</h4>
              <div className="bm-view-detail-grid">
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">Product Name</span>
                  <span className="bm-view-detail-value">{detail.name}</span>
                </div>
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">SKU / Barcode</span>
                  <span className="bm-view-detail-value">
                    {detail.partNumber ?? "—"}
                  </span>
                </div>
                <div className="bm-view-detail">
                  <span className="bm-view-detail-label">Size / Serving Notes</span>
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
                per-unit cost for this stock batch ({pricingUnitCount} unit
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
                    Selling Price / Unit
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
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [amountTendered, setAmountTendered] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<CompletedReceipt | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const base = `${API_URL}/api/pos/bike-management`;
  const auth = { Authorization: `Bearer ${token}` };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryResponse, productResponse] = await Promise.all([
        fetch(`${base}/product-categories`, { headers: auth }),
        fetch(`${base}/products?limit=5000`, { headers: auth }),
      ]);

      const [categoryPayload, productPayload] = (await Promise.all([
          categoryResponse.json(),
          productResponse.json(),
        ])) as [
          { data?: ProductCategory[]; message?: string },
          { data?: { products?: Product[] }; message?: string },
        ];

      if (
        [categoryResponse.status, productResponse.status].some(
          (status) => status === 401 || status === 403,
        )
      ) {
        logout();
        throw new Error("Session expired. Please sign in again.");
      }

      if (!categoryResponse.ok)
        throw new Error(categoryPayload.message ?? "Failed to load categories");
      if (!productResponse.ok)
        throw new Error(productPayload.message ?? "Failed to load products");

      setCategories(categoryPayload.data ?? []);
      setProducts(productPayload.data?.products ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load inventory data",
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const lowStockProducts = products.filter(
    (product) =>
      (product.lowStockThreshold ?? 0) > 0 &&
      product.quantity <= (product.lowStockThreshold ?? 0),
  );
  const lowStockCount = lowStockProducts.length;
  const visibleProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products
      .filter(
        (product) =>
          product.quantity > 0 &&
          product.sellingPrice != null &&
          (categoryFilter === "all" || product.category.id === categoryFilter) &&
          (!needle || [
            product.name,
            product.brand.name,
            product.category.name,
            product.partNumber,
            product.compatibleWith,
          ].some((value) => value?.toLowerCase().includes(needle))),
      )
      .sort((left, right) => {
        if ((left.quantity > 0) !== (right.quantity > 0)) {
          return left.quantity > 0 ? -1 : 1;
        }
        const categoryOrder = left.category.name.localeCompare(
          right.category.name,
        );
        return categoryOrder || left.name.localeCompare(right.name);
      });
  }, [categoryFilter, products, search]);
  const cartItemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = roundCurrency(
    cart.reduce(
      (sum, line) => sum + (line.product.sellingPrice ?? 0) * line.quantity,
      0,
    ),
  );
  const tendered = Number(amountTendered || "0");
  const changeDue = paymentMethod === "CASH" && Number.isFinite(tendered)
    ? Math.max(0, roundCurrency(tendered - cartTotal))
    : 0;

  const addToCart = (product: Product) => {
    if (product.quantity <= 0 || product.sellingPrice == null) return;
    setCheckoutMessage(null);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (!existing) return [...current, { product, quantity: 1 }];
      if (existing.quantity >= product.quantity) return current;
      return current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
    });
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const changeCartQuantity = (productId: number, delta: number) => {
    setCart((current) => current
      .map((line) => line.product.id === productId
        ? { ...line, quantity: Math.min(line.product.quantity, line.quantity + delta) }
        : line)
      .filter((line) => line.quantity > 0));
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "CASH" && (!Number.isFinite(tendered) || tendered < cartTotal)) {
      setError("Enter the cash received before completing the sale.");
      return;
    }
    setCheckingOut(true);
    setError(null);
    setCheckoutMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/pos/user-management/checkout`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            unitPrice: line.product.sellingPrice ?? 0,
          })),
          paymentMethod,
        }),
      });
      const payload = await response.json().catch(() => null) as { data?: { invoiceGroupCode: string }; message?: string } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.message ?? "Checkout failed");
      const receipt: CompletedReceipt = {
        invoiceNumber: payload.data.invoiceGroupCode,
        lines: cart.map((line) => ({
          name: line.product.name,
          quantity: line.quantity,
          unitPrice: line.product.sellingPrice ?? 0,
          total: roundCurrency((line.product.sellingPrice ?? 0) * line.quantity),
        })),
        paymentMethod,
        total: cartTotal,
        amountReceived: paymentMethod === "CASH" ? tendered : cartTotal,
        change: paymentMethod === "CASH" ? changeDue : 0,
        completedAt: new Date().toISOString(),
      };
      setCheckoutMessage(`Sale complete · ${payload.data.invoiceGroupCode}`);
      setCompletedReceipt(receipt);
      setCart([]);
      setAmountTendered("");
      await loadData();
      window.setTimeout(() => printReceipt(receipt), 100);
      window.setTimeout(() => searchInputRef.current?.focus(), 1500);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout failed");
    } finally {
      setCheckingOut(false);
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
            <h2 className="page-title">Bar Counter</h2>
            <p className="page-subtitle">
              Tap products, check the order, and take payment.
            </p>
          </div>
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}
      {checkoutMessage && (
        <div className="pos-sale-success">
          <span>✓ {checkoutMessage}</span>
          {completedReceipt && <button type="button" onClick={() => printReceipt(completedReceipt)}>🖨 Print bill again</button>}
        </div>
      )}

      <div className="pos-register-layout">
      <section className="pos-catalog" aria-label="Products available to sell">
        <div className="pos-catalog-toolbar">
          <div>
            <h3>Products</h3>
            <p>{visibleProducts.length} available · {lowStockCount} low stock</p>
          </div>
          <div className="pos-catalog-search">
            <input
              ref={searchInputRef}
              className="bm-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const exactBarcode = products.find((product) => product.partNumber?.toLowerCase() === search.trim().toLowerCase() && product.quantity > 0 && product.sellingPrice != null);
                const product = exactBarcode ?? (visibleProducts.length === 1 ? visibleProducts[0] : undefined);
                if (product) { addToCart(product); setSearch(""); }
              }}
              placeholder="Scan barcode or search drinks"
              aria-label="Search products"
              autoFocus
            />
            <button type="button" className="pos-icon-action" onClick={() => void loadData()} aria-label="Refresh products">↻</button>
          </div>
        </div>

        <div className="pos-category-tabs" aria-label="Filter products by category">
          <button type="button" className={categoryFilter === "all" ? "active" : ""} onClick={() => setCategoryFilter("all")}>All products</button>
          {categories.map((category) => (
            <button key={category.id} type="button" className={categoryFilter === category.id ? "active" : ""} onClick={() => setCategoryFilter(category.id)}>
              {category.name}
            </button>
          ))}
        </div>

        {loading && <div className="pos-catalog-empty">Loading products…</div>}
        {!loading && visibleProducts.length === 0 && <div className="pos-catalog-empty">No products match this selection.</div>}
        {!loading && visibleProducts.length > 0 && (
          <div className="pos-product-grid">
            {visibleProducts.map((product) => {
              const primaryImage = (product.images ?? []).find((image) => image.isPrimary) ?? product.images?.[0];
              const lowStock = (product.lowStockThreshold ?? 0) > 0 && product.quantity <= (product.lowStockThreshold ?? 0);
              return (
                <article key={product.id} className={`pos-product-card${product.quantity <= 0 ? " sold-out" : ""}`}>
                  <button type="button" className="pos-product-image" onClick={() => addToCart(product)} aria-label={`Add ${product.name} to order`}>
                    {primaryImage ? <img src={`${API_URL}${primaryImage.url}`} alt={product.name} /> : <span aria-hidden="true">🍺</span>}
                    <span className="pos-product-category">{product.category.name}</span>
                  </button>
                  <div className="pos-product-body">
                    <div className="pos-product-meta">{product.brand.name}{product.compatibleWith ? ` · ${product.compatibleWith}` : ""}</div>
                    <h4>{product.name}</h4>
                    <div className="pos-product-price">{product.sellingPrice != null ? formatCurrency(product.sellingPrice) : "Price not set"}</div>
                    <div className="pos-product-stock-row">
                      <span className={`pos-stock${lowStock ? " low" : ""}${product.quantity <= 0 ? " out" : ""}`}>
                        {product.quantity > 0 ? `${product.quantity} in stock` : "Out of stock"}
                      </span>
                      {product.partNumber && <span className="pos-product-sku">{product.partNumber}</span>}
                    </div>
                    <button type="button" className="pos-sell-button" disabled={product.quantity <= 0 || product.sellingPrice == null} onClick={() => addToCart(product)}>
                      {product.quantity <= 0 ? "Out of stock" : product.sellingPrice == null ? "Set price first" : cart.some((line) => line.product.id === product.id) ? "Add another" : "+ Add to order"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className="pos-cart" aria-label="Current order">
        <div className="pos-cart-header">
          <div><span>Current order</span><strong>{cartItemCount} item{cartItemCount === 1 ? "" : "s"}</strong></div>
          {cart.length > 0 && <button type="button" onClick={() => { setCart([]); setAmountTendered(""); }}>Clear</button>}
        </div>
        <div className="pos-cart-lines">
          {cart.length === 0 ? (
            <div className="pos-cart-empty"><span>🛒</span><strong>No items yet</strong><p>Tap a product to add it here.</p></div>
          ) : cart.map((line) => (
            <div key={line.product.id} className="pos-cart-line">
              <div className="pos-cart-line-main">
                <strong>{line.product.name}</strong>
                <span>{formatCurrency(line.product.sellingPrice)} each</span>
              </div>
              <div className="pos-cart-line-controls">
                <button type="button" onClick={() => changeCartQuantity(line.product.id, -1)} aria-label={`Remove one ${line.product.name}`}>−</button>
                <strong>{line.quantity}</strong>
                <button type="button" onClick={() => changeCartQuantity(line.product.id, 1)} disabled={line.quantity >= line.product.quantity} aria-label={`Add one ${line.product.name}`}>+</button>
              </div>
              <span className="pos-cart-line-total">{formatCurrency((line.product.sellingPrice ?? 0) * line.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="pos-cart-checkout">
          <div className="pos-cart-total"><span>Total</span><strong>{formatCurrency(cartTotal)}</strong></div>
          <div className="pos-payment-buttons" aria-label="Payment method">
            <button type="button" className={paymentMethod === "CASH" ? "active" : ""} onClick={() => setPaymentMethod("CASH")}>💵 Cash</button>
            <button type="button" className={paymentMethod === "BANK_TRANSFER" ? "active" : ""} onClick={() => { setPaymentMethod("BANK_TRANSFER"); setAmountTendered(""); }}>💳 Card / Transfer</button>
          </div>
          {paymentMethod === "CASH" && cart.length > 0 && (
            <div className="pos-cash-area">
              <label>Cash received</label>
              <input value={amountTendered} onChange={(event) => setAmountTendered(event.target.value)} inputMode="decimal" type="number" min={0} step="0.01" placeholder="0.00" />
              <div className="pos-quick-cash">
                {[cartTotal, Math.ceil(cartTotal / 100) * 100, Math.ceil(cartTotal / 500) * 500]
                  .filter((value, index, values) => value > 0 && values.indexOf(value) === index)
                  .map((value) => <button key={value} type="button" onClick={() => setAmountTendered(String(value))}>{formatCurrency(value)}</button>)}
              </div>
              <div className="pos-change"><span>Change</span><strong>{formatCurrency(changeDue)}</strong></div>
            </div>
          )}
          <button type="button" className="pos-complete-sale" disabled={cart.length === 0 || checkingOut || (paymentMethod === "CASH" && tendered < cartTotal)} onClick={() => void checkout()}>
            {checkingOut ? "Completing…" : `Complete sale · ${formatCurrency(cartTotal)}`}
          </button>
          <div className="pos-cart-shortcuts">
            <Link href="/dashboard/inventory/sold">Recent sales</Link>
            <Link href="/dashboard/inventory/manage">Product setup</Link>
          </div>
        </div>
      </aside>
      </div>

    </div>
  );
}
