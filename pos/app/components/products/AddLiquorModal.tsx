"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "../../lib/constants";
import { beep } from "../../lib/beep";
import { looksLikeBarcode, normalizeBarcode, useBarcodeScanner } from "../../lib/useBarcodeScanner";
import { IconBoxIn, IconPlus, IconScan } from "../../lib/icons";
import { ProductArt } from "./ProductArt";
import {
  ProductModal,
  type Product,
  type ProductBrand,
  type ProductCategory,
  type Supplier,
} from "./ProductFormModal";

type ReceiveLine = { product: Product; quantity: number; batchCost: string };

type AddLiquorModalProps = {
  token: string;
  /** A barcode scanned elsewhere (e.g. at the counter) to process as soon as the modal opens. */
  initialCode?: string;
  onClose: () => void;
  /** Called after stock was added or a product was created, so the caller can reload. */
  onStockChanged: () => void;
  onAuthExpired: () => void;
};

/**
 * "Add liquor" — receive stock by barcode reader or by hand.
 * Known barcodes build a receiving list (each extra scan adds +1); unknown barcodes open the
 * new-product form with the barcode filled in; "No barcode" adds a product manually.
 */
export function AddLiquorModal({ token, initialCode, onClose, onStockChanged, onAuthExpired }: AddLiquorModalProps) {
  const base = `${API_URL}/api/pos/inventory-management`;
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ barcode?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialCodeHandled = useRef(false);

  const loadCatalog = useCallback(async () => {
    try {
      const [productRes, brandRes, categoryRes, supplierRes] = await Promise.all([
        fetch(`${base}/products?limit=5000`, { headers: auth, cache: "no-store" }),
        fetch(`${base}/product-brands`, { headers: auth, cache: "no-store" }),
        fetch(`${base}/product-categories`, { headers: auth, cache: "no-store" }),
        fetch(`${base}/suppliers`, { headers: auth, cache: "no-store" }),
      ]);
      if ([productRes, brandRes, categoryRes, supplierRes].some((res) => res.status === 401)) {
        onAuthExpired();
        return [];
      }
      const [productJson, brandJson, categoryJson, supplierJson] = await Promise.all([
        productRes.json(), brandRes.json(), categoryRes.json(), supplierRes.json(),
      ]) as [
        { data?: { products?: Product[] }; message?: string },
        { data?: ProductBrand[] },
        { data?: ProductCategory[] },
        { data?: Supplier[] },
      ];
      if (!productRes.ok) throw new Error(productJson.message ?? "Failed to load products");
      const loaded = productJson.data?.products ?? [];
      setProducts(loaded);
      setBrands(brandJson.data ?? []);
      setCategories(categoryJson.data ?? []);
      setSuppliers(supplierRes.ok ? supplierJson.data ?? [] : []);
      return loaded;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load products");
      return [];
    } finally {
      setLoading(false);
    }
  }, [auth, base, onAuthExpired]);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  const addLine = useCallback((product: Product) => {
    setUnknownCode(null);
    setNotice(null);
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [{ product, quantity: 1, batchCost: "" }, ...current];
    });
    setFlashId(product.id);
    window.setTimeout(() => setFlashId(null), 450);
  }, []);

  const handleCode = useCallback((raw: string, catalog: Product[] = products) => {
    const code = raw.trim();
    if (!code) return;
    const match = catalog.find((product) => normalizeBarcode(product.partNumber) === normalizeBarcode(code));
    if (match) {
      beep("ok");
      addLine(match);
    } else {
      beep("error");
      setUnknownCode(code);
    }
    setQuery("");
  }, [addLine, products]);

  // Process a barcode handed over from the counter once the catalogue is loaded.
  useEffect(() => {
    if (loading || !initialCode || initialCodeHandled.current) return;
    initialCodeHandled.current = true;
    handleCode(initialCode);
  }, [handleCode, initialCode, loading]);

  useBarcodeScanner((code) => handleCode(code), !creating);

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return products
      .filter((product) => [product.name, product.brand.name, product.category.name, product.partNumber]
        .some((value) => value?.toLowerCase().includes(needle)))
      .slice(0, 6);
  }, [products, query]);

  const submitQuery = () => {
    const value = query.trim();
    if (!value) return;
    const exact = products.find((product) => normalizeBarcode(product.partNumber) === normalizeBarcode(value));
    if (exact || looksLikeBarcode(value)) {
      handleCode(value);
    } else if (suggestions.length === 1) {
      addLine(suggestions[0]);
      setQuery("");
    }
  };

  const setLine = (productId: number, changes: Partial<ReceiveLine>) =>
    setLines((current) => current.map((line) => line.product.id === productId ? { ...line, ...changes } : line));

  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);

  const saveStock = async () => {
    setSaving(true);
    setError(null);
    const failed: string[] = [];
    for (const line of lines) {
      const cost = Number(line.batchCost);
      const response = await fetch(`${base}/products/${line.product.id}/restock`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: line.quantity,
          ...(line.batchCost.trim() && Number.isFinite(cost) ? { purchasePrice: cost } : {}),
        }),
      }).catch(() => null);
      if (response?.status === 401) { onAuthExpired(); return; }
      if (!response?.ok) failed.push(line.product.name);
    }
    setSaving(false);
    onStockChanged();
    if (failed.length > 0) {
      setError(`Could not add stock for: ${failed.join(", ")}`);
      setLines((current) => current.filter((line) => failed.includes(line.product.name)));
      return;
    }
    setNotice(`Added ${totalUnits} unit${totalUnits === 1 ? "" : "s"} to stock.`);
    setLines([]);
    void loadCatalog();
    inputRef.current?.focus();
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal lx-stockin" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Add liquor">
        <button className="bm-modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="lx-stockin-head">
          <span className="lx-stockin-icon"><IconBoxIn size={22} /></span>
          <div>
            <h3 className="bm-modal-title">Add liquor</h3>
            <p className="lx-card-sub">Scan bottles with the barcode reader, or search by name. Each scan adds one unit.</p>
          </div>
        </div>

        <div className="lx-scan-field">
          <IconScan size={22} />
          <input
            ref={inputRef}
            className="bm-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); submitQuery(); }
            }}
            placeholder={loading ? "Loading products…" : "Scan barcode or type product name"}
            disabled={loading}
            autoFocus
            autoComplete="off"
            aria-label="Scan barcode or search product"
          />
          <span className="lx-scan-status"><i /> Scanner ready</span>
        </div>

        {suggestions.length > 0 && (
          <div className="lx-suggestions lx-stagger">
            {suggestions.map((product, index) => (
              <button key={product.id} type="button" style={{ ["--i" as string]: index }} onClick={() => { addLine(product); setQuery(""); inputRef.current?.focus(); }}>
                <ProductArt className="lx-mini-art" categoryName={product.category.name} imageUrl={product.images?.[0]?.url} alt={product.name} iconSize={18} />
                <span><strong>{product.name}</strong><em>{product.brand.name} · {product.quantity} in stock{product.partNumber ? ` · ${product.partNumber}` : ""}</em></span>
                <IconPlus />
              </button>
            ))}
          </div>
        )}

        {unknownCode && (
          <div className="lx-unknown">
            <div>
              <strong>New barcode {unknownCode}</strong>
              <span>This bottle isn&apos;t in your stock yet.</span>
            </div>
            <button type="button" className="btn-accent" onClick={() => setCreating({ barcode: unknownCode })}>
              <IconPlus /> Create product
            </button>
          </div>
        )}
        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        {notice && <div className="bm-alert bm-alert-success">{notice}</div>}

        <div className="lx-receive-list">
          {lines.length === 0 ? (
            <div className="lx-receive-empty">
              <IconScan size={34} />
              <strong>Ready to receive stock</strong>
              <span>Scan a bottle to begin. Scanning the same bottle again adds another unit.</span>
            </div>
          ) : lines.map((line) => (
            <div key={line.product.id} className={`lx-receive-line${flashId === line.product.id ? " flash" : ""}`}>
              <ProductArt className="lx-mini-art" categoryName={line.product.category.name} imageUrl={line.product.images?.[0]?.url} alt={line.product.name} iconSize={20} />
              <div className="lx-receive-main">
                <strong>{line.product.name}</strong>
                <span>{line.product.brand.name} · now {line.product.quantity} → <b>{line.product.quantity + line.quantity}</b> in stock</span>
              </div>
              <input
                className="bm-input lx-receive-cost"
                type="number"
                min={0}
                step="0.01"
                value={line.batchCost}
                onChange={(event) => setLine(line.product.id, { batchCost: event.target.value })}
                placeholder="Total cost (optional)"
                aria-label={`Total cost paid for ${line.product.name}`}
              />
              <div className="pos-cart-line-controls">
                <button type="button" onClick={() => line.quantity <= 1 ? setLines((current) => current.filter((item) => item.product.id !== line.product.id)) : setLine(line.product.id, { quantity: line.quantity - 1 })} aria-label="One less">−</button>
                <input
                  className="lx-qty-input"
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(event) => setLine(line.product.id, { quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
                  aria-label={`Quantity of ${line.product.name}`}
                />
                <button type="button" onClick={() => setLine(line.product.id, { quantity: line.quantity + 1 })} aria-label="One more">+</button>
              </div>
            </div>
          ))}
        </div>

        <div className="lx-stockin-foot">
          <button type="button" className="btn-outline" onClick={() => setCreating({})}>
            <IconPlus /> New product without barcode
          </button>
          <div className="lx-stockin-actions">
            {lines.length > 0 && <span className="lx-card-sub">{lines.length} product{lines.length === 1 ? "" : "s"} · {totalUnits} unit{totalUnits === 1 ? "" : "s"}</span>}
            <button type="button" className="btn-accent" disabled={lines.length === 0 || saving} onClick={() => void saveStock()}>
              {saving ? "Saving…" : "Add to stock"}
            </button>
          </div>
        </div>
        {lines.some((line) => line.batchCost.trim()) && (
          <p className="lx-field-hint">Total cost is what you paid for the units being added. It updates the product&apos;s average cost per unit, which the dashboard uses for profit.</p>
        )}
      </div>

      {creating && (
        <div onClick={(event) => event.stopPropagation()}>
          <ProductModal
            token={token}
            brands={brands}
            categories={categories}
            suppliers={suppliers}
            initialBarcode={creating.barcode}
            existingProducts={products}
            onRestockInstead={(product) => { setCreating(null); addLine(product); }}
            onClose={() => { setCreating(null); window.setTimeout(() => inputRef.current?.focus(), 50); }}
            onSaved={() => {
              setUnknownCode(null);
              setNotice("New product saved with its opening stock.");
              onStockChanged();
              void loadCatalog();
            }}
            onBrandCreated={(brand) => setBrands((current) => [...current, brand].sort((a, b) => a.name.localeCompare(b.name)))}
            onCategoryCreated={(category) => setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)))}
            onSupplierCreated={(supplier) => setSuppliers((current) => [...current, supplier])}
            onAuthExpired={onAuthExpired}
          />
        </div>
      )}
    </div>
  );
}
