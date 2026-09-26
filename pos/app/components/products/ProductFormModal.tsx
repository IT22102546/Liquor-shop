"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../../lib/constants";
import { IconScan } from "../../lib/icons";

export type ProductBrand = { id: number; name: string; _count?: { products: number } };
export type ProductCategory = {
  id: number;
  name: string;
  _count?: { products: number };
};
export type Supplier = {
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
export type ProductImage = {
  id: number;
  productId: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
};
export type ProductExpense = {
  id?: number;
  description: string;
  amount: number;
  createdAt?: string;
};
export type Product = {
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
  /** Taken off the bill per empty bottle handed back; null = not returnable. */
  emptyBottlePrice?: number | null;
  /** Empties collected at the counter and not yet returned to the supplier. */
  emptyBottlesOnHand?: number;
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

export function formatCurrency(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Rs. 0.00";
  }

  return `Rs. ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  maxImages = MAX_PRODUCT_IMAGES,
}: {
  images: File[];
  onChange: (files: File[]) => void;
  onError?: (message: string) => void;
  /** Slots left for new photos (3 minus the photos the product already has). */
  maxImages?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = maxImages - images.length;

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
  const base = `${API_URL}/api/pos/inventory-management`;
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

/**
 * Photos already saved on a product (edit mode): shown whole, with "Make main" and a
 * two-step "Remove". Changes apply immediately.
 */
function ExistingPhotos({
  token,
  productId,
  onCountChange,
  onChanged,
  onError,
}: {
  token: string;
  productId: number;
  onCountChange: (count: number) => void;
  onChanged?: () => void;
  onError: (message: string) => void;
}) {
  const base = `${API_URL}/api/pos/inventory-management/products/${productId}/images`;
  const [photos, setPhotos] = useState<ProductImage[]>([]);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(base, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
    const payload = (await response?.json().catch(() => null)) as { data?: ProductImage[] } | null;
    const list = payload?.data ?? [];
    setPhotos(list);
    onCountChange(list.length);
  }, [base, onCountChange, token]);

  useEffect(() => { void load(); }, [load]);

  const act = async (photoId: number, method: "DELETE" | "PATCH") => {
    setBusyId(photoId);
    const response = await fetch(method === "DELETE" ? `${base}/${photoId}` : `${base}/${photoId}/primary`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    setBusyId(null);
    setConfirmingId(null);
    if (!response?.ok) {
      onError(method === "DELETE" ? "Could not remove the photo" : "Could not change the main photo");
      return;
    }
    await load();
    onChanged?.();
  };

  if (photos.length === 0) return null;
  return (
    <div className="lx-photo-grid">
      {photos.map((photo) => (
        <div key={photo.id} className={`lx-photo${photo.isPrimary ? " main" : ""}`}>
          <img src={`${API_URL}${photo.url}`} alt="Product photo" />
          {photo.isPrimary && <span className="lx-photo-badge">Main photo</span>}
          <div className="lx-photo-actions">
            {confirmingId === photo.id ? (
              <>
                <button type="button" className="danger" disabled={busyId === photo.id} onClick={() => void act(photo.id, "DELETE")}>Yes, remove</button>
                <button type="button" onClick={() => setConfirmingId(null)}>Keep</button>
              </>
            ) : (
              <>
                {!photo.isPrimary && <button type="button" disabled={busyId === photo.id} onClick={() => void act(photo.id, "PATCH")}>Make main</button>}
                <button type="button" className="danger" onClick={() => setConfirmingId(photo.id)}>Remove</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductModal({
  token,
  brands,
  categories,
  suppliers,
  product,
  initialBarcode,
  existingProducts = [],
  onRestockInstead,
  onPhotosChanged,
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
  /** Pre-fills the barcode, e.g. after scanning a bottle that isn't in stock yet. */
  initialBarcode?: string;
  /** Used to warn when the barcode already belongs to another product. */
  existingProducts?: Product[];
  onRestockInstead?: (product: Product) => void;
  /** Called when a saved photo is removed or made the main photo (edit mode). */
  onPhotosChanged?: () => void;
  onClose: () => void;
  onSaved: () => void;
  onBrandCreated: (brand: ProductBrand) => void;
  onCategoryCreated: (category: ProductCategory) => void;
  onSupplierCreated: (supplier: Supplier) => void;
  onAuthExpired: () => void;
}) {
  const isEdit = !!product;
  const initialPricingUnitCount = getProductPricingUnitCount(product);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    brandId: product?.brandId ? String(product.brandId) : "",
    categoryId: product?.categoryId ? String(product.categoryId) : "",
    supplierId: product?.supplier?.id ? String(product.supplier.id) : "",
    name: product?.name ?? "",
    partNumber: product?.partNumber ?? initialBarcode ?? "",
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
    emptyBottlePrice:
      product?.emptyBottlePrice != null ? String(product.emptyBottlePrice) : "",
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
  const [existingPhotoCount, setExistingPhotoCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const base = `${API_URL}/api/pos/inventory-management`;
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
  const barcodeOwner = form.partNumber.trim()
    ? existingProducts.find(
        (item) =>
          item.id !== product?.id &&
          item.partNumber?.trim().toLowerCase() === form.partNumber.trim().toLowerCase(),
      )
    : undefined;
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
            emptyBottlePrice: form.emptyBottlePrice.trim()
              ? Number(form.emptyBottlePrice)
              : isEdit
                ? null
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
            : "Add liquor"}
        </h3>
        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <form className="bm-modal-form" onSubmit={submit}>
          <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
            <label>Product Photos (max 3)</label>
            {isEdit && product && (
              <ExistingPhotos
                token={token}
                productId={product.id}
                onCountChange={setExistingPhotoCount}
                onChanged={onPhotosChanged}
                onError={setError}
              />
            )}
            {MAX_PRODUCT_IMAGES - existingPhotoCount > 0 ? (
              <ProductImageUploader
                images={imageFiles}
                onChange={setImageFiles}
                onError={setError}
                maxImages={MAX_PRODUCT_IMAGES - existingPhotoCount}
              />
            ) : (
              <p className="bm-img-hint">This product already has 3 photos. Remove one to add another.</p>
            )}
          </div>

          <div className="bm-fields-grid">
            <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="product-barcode">Barcode</label>
              <div className="pos-search-field" style={{ maxWidth: "none" }}>
                <IconScan />
                <input
                  id="product-barcode"
                  className="bm-input"
                  value={form.partNumber}
                  onChange={setEvent("partNumber")}
                  onKeyDown={(event) => {
                    // Scanners press Enter after the code — move on instead of submitting the form.
                    if (event.key === "Enter") {
                      event.preventDefault();
                      nameInputRef.current?.focus();
                    }
                  }}
                  placeholder="Scan the bottle with the barcode reader, or type the number"
                  autoFocus={!isEdit && !initialBarcode}
                  autoComplete="off"
                />
              </div>
              {barcodeOwner ? (
                <span className="lx-field-warning">
                  This barcode already belongs to <strong>{barcodeOwner.name}</strong>.
                  {onRestockInstead && (
                    <button type="button" onClick={() => onRestockInstead(barcodeOwner)}>
                      Add stock to it instead
                    </button>
                  )}
                </span>
              ) : (
                <span className="lx-field-hint">Leave empty for items without a barcode — they can still be sold by tapping them at the counter.</span>
              )}
            </div>

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
                ref={nameInputRef}
                className="bm-input"
                autoFocus={!isEdit && !!initialBarcode}
                value={form.name}
                onChange={setEvent("name")}
                placeholder="e.g. Lion Lager 330ml"
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
              <label htmlFor="empty-bottle-price">Empty Bottle Price (per bottle)</label>
              <input
                id="empty-bottle-price"
                className="bm-input"
                type="number"
                min={0}
                step="0.01"
                value={form.emptyBottlePrice}
                onChange={setEvent("emptyBottlePrice")}
                placeholder="e.g. 60 — leave empty for cans"
              />
              <span className="lx-field-hint">
                Taken off the bill for each empty bottle the customer gives back.
                {Number(form.emptyBottlePrice) > 0 && Number(form.sellingPrice) > 0
                  ? ` With an empty: ${formatCurrency(Number(form.sellingPrice) - Number(form.emptyBottlePrice))}.`
                  : ""}
              </span>
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
            <button type="submit" className="btn-accent" disabled={saving || Boolean(barcodeOwner)}>
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
