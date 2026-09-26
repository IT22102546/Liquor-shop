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
import { AddLiquorModal } from "../../components/products/AddLiquorModal";
import { ProductArt } from "../../components/products/ProductArt";
import type { Product, ProductCategory } from "../../components/products/ProductFormModal";
import { API_URL } from "../../lib/constants";
import { beep } from "../../lib/beep";
import { useCountUp } from "../../lib/useCountUp";
import { normalizeBarcode, useBarcodeScanner } from "../../lib/useBarcodeScanner";
import {
  IconBoxIn,
  IconCard,
  IconCart,
  IconCash,
  IconCheck,
  IconInventory,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconScan,
  IconSearch,
} from "../../lib/icons";

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

type ScanToast = {
  id: number;
  kind: "ok" | "error";
  title: string;
  detail?: string;
  /** Unknown barcode that a stock manager can add straight away. */
  unknownCode?: string;
};

function AnimatedMoney({ value }: { value: number }) {
  return <>{formatCurrency(useCountUp(value, 450))}</>;
}

export default function InventoryPage() {
  const { admin, token, logout } = useAdmin();
  const canManageStock = admin.role === "ADMIN" || admin.role === "INVENTORY_MANAGER";
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
  const [stockIn, setStockIn] = useState<{ initialCode?: string } | null>(null);
  const [toasts, setToasts] = useState<ScanToast[]>([]);
  const [bumpedId, setBumpedId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const base = `${API_URL}/api/pos/inventory-management`;
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

  const lowStockCount = products.filter(
    (product) =>
      (product.lowStockThreshold ?? 0) > 0 &&
      product.quantity <= (product.lowStockThreshold ?? 0),
  ).length;
  const sellable = (product: Product) => product.quantity > 0 && product.sellingPrice != null;
  const visibleProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products
      .filter(
        (product) =>
          sellable(product) &&
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
        const categoryOrder = left.category.name.localeCompare(right.category.name);
        return categoryOrder || left.name.localeCompare(right.name);
      });
  }, [categoryFilter, products, search]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<number, number>();
    products.filter(sellable).forEach((product) => counts.set(product.category.id, (counts.get(product.category.id) ?? 0) + 1));
    return counts;
  }, [products]);
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

  const showToast = (toast: Omit<ScanToast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), toast.unknownCode ? 7000 : 2600);
  };

  /** Adds one unit; returns false when the product can't be sold right now. */
  const addToCart = (product: Product) => {
    if (!sellable(product)) return false;
    const inCart = cart.find((line) => line.product.id === product.id)?.quantity ?? 0;
    if (inCart >= product.quantity) return false;
    setCheckoutMessage(null);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (!existing) return [...current, { product, quantity: 1 }];
      return current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
    });
    setBumpedId(product.id);
    window.setTimeout(() => setBumpedId((current) => (current === product.id ? null : current)), 360);
    return true;
  };

  // Selling by barcode: works from the search box (typed or scanned) and from anywhere on the page.
  const sellByBarcode = (rawCode: string) => {
    const code = rawCode.trim();
    const product = products.find((item) => normalizeBarcode(item.partNumber) === normalizeBarcode(code));
    if (!product) {
      beep("error");
      showToast({ kind: "error", title: `Unknown barcode ${code}`, detail: "This bottle isn't in stock yet.", unknownCode: canManageStock ? code : undefined });
      return;
    }
    if (product.quantity <= 0) {
      beep("error");
      showToast({ kind: "error", title: `${product.name} is out of stock` });
      return;
    }
    if (product.sellingPrice == null) {
      beep("error");
      showToast({ kind: "error", title: `${product.name} has no selling price`, detail: "Set a price in Product Setup first." });
      return;
    }
    if (!addToCart(product)) {
      beep("error");
      showToast({ kind: "error", title: `Only ${product.quantity} ${product.name} in stock` });
      return;
    }
    beep("ok");
    showToast({ kind: "ok", title: `Added ${product.name}`, detail: formatCurrency(product.sellingPrice) });
  };

  useBarcodeScanner(sellByBarcode, !stockIn);

  const changeCartQuantity = (productId: number, delta: number) => {
    setCart((current) => current
      .map((line) => line.product.id === productId
        ? { ...line, quantity: Math.min(line.product.quantity, line.quantity + delta) }
        : line)
      .filter((line) => line.quantity > 0));
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
          amountReceived: paymentMethod === "CASH" ? tendered : undefined,
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
              Scan a bottle or tap a product, then take payment.
            </p>
          </div>
        </div>
        <div className="pos-header-actions">
          <span className="lx-scan-status" title="Scan a barcode anytime on this page to add it to the order"><i /> Scanner ready</span>
          {canManageStock && (
            <button type="button" className="btn-accent pos-add-liquor" onClick={() => setStockIn({})}>
              <IconBoxIn /> Add liquor
            </button>
          )}
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}
      {checkoutMessage && (
        <div className="pos-sale-success">
          <span className="check"><IconCheck size={20} /> {checkoutMessage}</span>
          {completedReceipt && <button type="button" onClick={() => printReceipt(completedReceipt)}><IconPrinter size={15} /> Print bill again</button>}
        </div>
      )}

      <div className="pos-register-layout">
      <section className="pos-catalog" aria-label="Products available to sell">
        <div className="pos-catalog-toolbar">
          <div>
            <h3>Products</h3>
            <p>{visibleProducts.length} ready to sell · {lowStockCount} low stock</p>
          </div>
          <div className="pos-catalog-search">
            <div className="pos-search-field">
              <IconSearch />
              <input
                ref={searchInputRef}
                className="bm-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const value = search.trim();
                  if (!value) return;
                  const exactBarcode = products.some((product) => normalizeBarcode(product.partNumber) === normalizeBarcode(value));
                  if (exactBarcode || visibleProducts.length === 0) {
                    sellByBarcode(value);
                    setSearch("");
                  } else if (visibleProducts.length === 1) {
                    if (addToCart(visibleProducts[0])) beep("ok");
                    setSearch("");
                  }
                }}
                placeholder="Scan barcode or search drinks"
                aria-label="Scan barcode or search products"
                autoComplete="off"
              />
              <kbd>Enter</kbd>
            </div>
            <button type="button" className="pos-icon-action" onClick={() => void loadData()} aria-label="Refresh products"><IconRefresh /></button>
          </div>
        </div>

        <div className="pos-category-tabs" aria-label="Filter products by category">
          <button type="button" className={categoryFilter === "all" ? "active" : ""} onClick={() => setCategoryFilter("all")}>
            All <span className="count">{products.filter(sellable).length}</span>
          </button>
          {categories.map((category) => (
            <button key={category.id} type="button" className={categoryFilter === category.id ? "active" : ""} onClick={() => setCategoryFilter(category.id)}>
              {category.name} <span className="count">{categoryCounts.get(category.id) ?? 0}</span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="pos-product-grid" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => <div key={index} className="lx-skel" style={{ height: 206, borderRadius: 16 }} />)}
          </div>
        )}
        {!loading && visibleProducts.length === 0 && (
          <div className="pos-catalog-empty">
            {products.length === 0 ? (
              <>
                <IconScan size={40} />
                <strong>No liquor in stock yet</strong>
                <p>{canManageStock ? "Add your first bottles by scanning their barcodes or entering them by hand." : "Ask a manager to add products to stock."}</p>
                {canManageStock && <button type="button" className="btn-accent" onClick={() => setStockIn({})}><IconBoxIn /> Add liquor</button>}
              </>
            ) : (
              <>
                <strong>No products match this selection</strong>
                <p>Try another category or search, or scan the bottle&apos;s barcode.</p>
              </>
            )}
          </div>
        )}
        {!loading && visibleProducts.length > 0 && (
          <div className="pos-product-grid">
            {visibleProducts.map((product, index) => {
              const primaryImage = (product.images ?? []).find((image) => image.isPrimary) ?? product.images?.[0];
              const lowStock = (product.lowStockThreshold ?? 0) > 0 && product.quantity <= (product.lowStockThreshold ?? 0);
              const inCart = cart.find((line) => line.product.id === product.id)?.quantity ?? 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  className={`pos-product-card${inCart > 0 ? " in-cart" : ""}${bumpedId === product.id ? " bump" : ""}`}
                  style={{ ["--i" as string]: index }}
                  onClick={() => { if (addToCart(product)) beep("ok"); }}
                  disabled={inCart >= product.quantity}
                  aria-label={`Add ${product.name} to order`}
                >
                  <ProductArt categoryName={product.category.name} imageUrl={primaryImage?.url} alt={product.name}>
                    <span className="pos-product-category">{product.category.name}</span>
                    {inCart > 0 && <span key={inCart} className="pos-product-qty-badge">{inCart}</span>}
                  </ProductArt>
                  <div className="pos-product-body">
                    <div className="pos-product-meta">{product.brand.name}{product.compatibleWith ? ` · ${product.compatibleWith}` : ""}</div>
                    <div className="pos-product-name">{product.name}</div>
                    <span className={`pos-stock${lowStock ? " low" : ""}`}>{product.quantity} in stock</span>
                    <div className="pos-product-foot">
                      <span className="pos-product-price">{formatCurrency(product.sellingPrice)}</span>
                      <span className="pos-product-add" aria-hidden="true"><IconPlus /></span>
                    </div>
                  </div>
                </button>
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
            <div className="pos-cart-empty"><IconCart size={38} /><strong>No items yet</strong><p>Scan a barcode or tap a product.</p></div>
          ) : cart.map((line) => (
            <div key={line.product.id} className="pos-cart-line">
              <div className="pos-cart-line-main">
                <strong>{line.product.name}</strong>
                <span>{formatCurrency(line.product.sellingPrice)} each</span>
              </div>
              <div className="pos-cart-line-controls">
                <button type="button" onClick={() => changeCartQuantity(line.product.id, -1)} aria-label={`Remove one ${line.product.name}`}>−</button>
                <strong key={line.quantity}>{line.quantity}</strong>
                <button type="button" onClick={() => changeCartQuantity(line.product.id, 1)} disabled={line.quantity >= line.product.quantity} aria-label={`Add one ${line.product.name}`}>+</button>
              </div>
              <span className="pos-cart-line-total">{formatCurrency((line.product.sellingPrice ?? 0) * line.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="pos-cart-checkout">
          <div className="pos-cart-total"><span>Total</span><strong><AnimatedMoney value={cartTotal} /></strong></div>
          <div className="pos-payment-buttons" aria-label="Payment method">
            <button type="button" className={paymentMethod === "CASH" ? "active" : ""} onClick={() => setPaymentMethod("CASH")}><IconCash /> Cash</button>
            <button type="button" className={paymentMethod === "BANK_TRANSFER" ? "active" : ""} onClick={() => { setPaymentMethod("BANK_TRANSFER"); setAmountTendered(""); }}><IconCard /> Card / Transfer</button>
          </div>
          {paymentMethod === "CASH" && cart.length > 0 && (
            <div className="pos-cash-area">
              <label htmlFor="cash-received">Cash received</label>
              <input id="cash-received" value={amountTendered} onChange={(event) => setAmountTendered(event.target.value)} inputMode="decimal" type="number" min={0} step="0.01" placeholder="0.00" />
              <div className="pos-quick-cash">
                {[cartTotal, Math.ceil(cartTotal / 100) * 100, Math.ceil(cartTotal / 500) * 500, Math.ceil(cartTotal / 1000) * 1000]
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
            {canManageStock && <Link href="/dashboard/inventory/manage">Product setup</Link>}
          </div>
        </div>
      </aside>
      </div>

      <div className="lx-toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`lx-toast ${toast.kind}`}>
            <span className="lx-toast-icon">{toast.kind === "ok" ? <IconCheck size={16} /> : <IconScan size={16} />}</span>
            <div>
              <strong>{toast.title}</strong>
              {toast.detail && <span>{toast.detail}</span>}
            </div>
            {toast.unknownCode && (
              <button type="button" className="btn-accent" onClick={() => { setStockIn({ initialCode: toast.unknownCode }); setToasts([]); }}>
                Add it now
              </button>
            )}
          </div>
        ))}
      </div>

      {stockIn && (
        <AddLiquorModal
          token={token}
          initialCode={stockIn.initialCode}
          onClose={() => setStockIn(null)}
          onStockChanged={() => void loadData()}
          onAuthExpired={logout}
        />
      )}
    </div>
  );
}
