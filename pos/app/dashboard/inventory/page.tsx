"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAdmin } from "../../components/AdminContext";
import { AddLiquorModal } from "../../components/products/AddLiquorModal";
import { MemberPicker, type LoyaltyMember } from "../../components/customers/MemberPicker";
import { useShopSettings } from "../../lib/useShopSettings";
import { ProductArt } from "../../components/products/ProductArt";
import type { Product, ProductCategory } from "../../components/products/ProductFormModal";
import { API_URL } from "../../lib/constants";
import { beep } from "../../lib/beep";
import { printReceipt, type SaleReceipt } from "../../lib/receipt";
import { ReceiptModal } from "../../components/receipt/ReceiptModal";
import { ROLE_LABELS } from "../../lib/roles";
import { useCountUp } from "../../lib/useCountUp";
import { normalizeBarcode, useBarcodeScanner } from "../../lib/useBarcodeScanner";
import {
  IconBottle,
  IconBoxIn,
  IconCard,
  IconCart,
  IconCash,
  IconCheck,
  IconClock,
  IconQr,
  IconInventory,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconScan,
  IconSearch,
} from "../../lib/icons";

/** What the checkout API returns for a completed sale. */
type CheckoutResult = {
  invoiceGroupCode: string;
  paymentMethod: SaleReceipt["paymentMethod"];
  paymentReference?: string | null;
  subtotal?: number;
  emptyDeduction?: number;
  emptiesReturned?: number;
  total: number;
  amountReceived: number;
  changeGiven: number;
  purchases: Array<{ productId: number; name: string; quantity: number; unitPrice: number; emptiesReturned?: number; emptyDeduction?: number; lineTotal: number }>;
  counterSale?: { createdAt: string };
  member?: { id: number; name: string; mobileNumber: string; pointsEarned: number; pointsRedeemed?: number; pointsBalance: number } | null;
  discount?: { type: "PERCENT" | "AMOUNT"; value: number; amount: number } | null;
  pointsRedeemed?: number;
  pointsValue?: number;
};
/** `empties` = empty bottles the customer hands back for this product (never more than `quantity`). */
type CartLine = { product: Product; quantity: number; empties: number };
function formatCurrency(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Rs. 0.00";
  }

  return `Rs. ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}


type ScanToast = {
  id: number;
  kind: "ok" | "error";
  title: string;
  detail?: string;
  /** Unknown barcode that a stock manager can add straight away. */
  unknownCode?: string;
};

function emptyPriceOf(product: Product) {
  return product.emptyBottlePrice && product.emptyBottlePrice > 0 ? product.emptyBottlePrice : 0;
}

function AnimatedMoney({ value }: { value: number }) {
  return <>{formatCurrency(useCountUp(value, 450))}</>;
}

export default function InventoryPage() {
  const { admin, token, logout } = useAdmin();
  const canManageStock = admin.role === "ADMIN" || admin.role === "INVENTORY_MANAGER";
  const canStartShift = admin.role === "ADMIN" || admin.role === "CASHIER";
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  // Card approval code (printed on the card machine slip) or transfer / QR reference — optional.
  const [paymentReference, setPaymentReference] = useState("");
  const choosePayment = (method: "CASH" | "CARD" | "BANK_TRANSFER") => {
    setPaymentMethod(method);
    setPaymentReference("");
    if (method !== "CASH") setAmountTendered("");
  };
  const [amountTendered, setAmountTendered] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<SaleReceipt | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  // Every sale is walk-in unless a loyalty member is attached.
  const [member, setMember] = useState<LoyaltyMember | null>(null);
  const { settings } = useShopSettings(token);
  const [discountOn, setDiscountOn] = useState(false);
  const [discountType, setDiscountType] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [discountInput, setDiscountInput] = useState("");
  const [redeemOn, setRedeemOn] = useState(false);
  const [redeemInput, setRedeemInput] = useState("");
  const resetAdjustments = () => {
    setDiscountOn(false);
    setDiscountInput("");
    setRedeemOn(false);
    setRedeemInput("");
  };
  const changeMember = (next: LoyaltyMember | null) => {
    setMember(next);
    setRedeemOn(false);
    setRedeemInput("");
  };
  const [stockIn, setStockIn] = useState<{ initialCode?: string } | null>(null);
  // Selling needs an open shift (Day End): undefined = still checking.
  const [shift, setShift] = useState<{ shiftNo: string } | null | undefined>(undefined);
  const [suggestedFloat, setSuggestedFloat] = useState("");
  const [startingShift, setStartingShift] = useState(false);
  const loadShift = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/pos/shifts/current`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = (await response.json()) as { data?: { open: { shiftNo: string } | null; suggestedFloat: number } };
      if (!response.ok || !payload.data) return;
      setShift(payload.data.open);
      setSuggestedFloat((value) => value || String(payload.data?.suggestedFloat ?? ""));
    } catch {
      /* the counter still works; checkout will say if no shift is open */
    }
  }, [token]);
  useEffect(() => { void loadShift(); }, [loadShift]);
  const startShift = async () => {
    const openingFloat = Number(suggestedFloat || "0");
    if (!(openingFloat >= 0)) return;
    setStartingShift(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/pos/shifts/open`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ openingFloat }) });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) setError(payload?.message ?? "Could not start the shift");
      await loadShift();
    } finally {
      setStartingShift(false);
    }
  };
  const [toasts, setToasts] = useState<ScanToast[]>([]);
  const [bumpedId, setBumpedId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const registerRef = useRef<HTMLDivElement>(null);

  // Till layout: the counter fills exactly the space below the heading, so the page itself never
  // scrolls — the product list and the order panel each scroll on their own. Re-fit when the
  // window resizes or something above changes height (success banner, errors).
  useLayoutEffect(() => {
    const register = registerRef.current;
    if (!register) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.innerWidth <= 760) {
          register.style.height = "";
          return;
        }
        const top = register.getBoundingClientRect().top + window.scrollY;
        register.style.height = `${Math.max(420, window.innerHeight - top - 18)}px`;
      });
    };
    fit();
    window.addEventListener("resize", fit);
    const observer = new ResizeObserver(fit);
    if (register.parentElement) {
      Array.from(register.parentElement.children).forEach((child) => { if (child !== register) observer.observe(child); });
    }
    const siblingsWatcher = new MutationObserver(() => {
      observer.disconnect();
      Array.from(register.parentElement?.children ?? []).forEach((child) => { if (child !== register) observer.observe(child); });
      fit();
    });
    if (register.parentElement) siblingsWatcher.observe(register.parentElement, { childList: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", fit);
      observer.disconnect();
      siblingsWatcher.disconnect();
    };
  }, []);

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
  const cartSubtotal = roundCurrency(
    cart.reduce(
      (sum, line) => sum + (line.product.sellingPrice ?? 0) * line.quantity,
      0,
    ),
  );
  const cartEmptyDeduction = roundCurrency(
    cart.reduce((sum, line) => sum + emptyPriceOf(line.product) * line.empties, 0),
  );
  const cartEmptiesCount = cart.reduce((sum, line) => sum + line.empties, 0);
  const afterEmpties = roundCurrency(cartSubtotal - cartEmptyDeduction);

  // Discount (when switched on in Shop Settings) — percentage or fixed amount, any customer.
  const discountValue = Number(discountInput);
  const discountActive = settings.discountsEnabled && discountOn && Number.isFinite(discountValue) && discountValue > 0;
  const discountAmount = discountActive
    ? Math.min(afterEmpties, roundCurrency(discountType === "PERCENT" ? (afterEmpties * Math.min(discountValue, 100)) / 100 : discountValue))
    : 0;
  const discountPercentOfBill = afterEmpties > 0 ? (discountAmount / afterEmpties) * 100 : 0;
  const discountOverLimit = discountActive && admin.role !== "ADMIN" && discountPercentOfBill > settings.maxCashierDiscountPercent + 0.001;
  const afterDiscount = roundCurrency(afterEmpties - discountAmount);

  // Loyalty points (registered members only, when switched on). Point value comes from Shop Settings.
  const pointValue = settings.loyaltyPointValue > 0 ? settings.loyaltyPointValue : 1;
  const canRedeem = settings.loyaltyRedemptionEnabled && Boolean(member) && (member?.loyaltyPoints ?? 0) > 0;
  const maxPoints = canRedeem ? Math.min(member?.loyaltyPoints ?? 0, Math.floor((afterDiscount + 0.000001) / pointValue)) : 0;
  const pointsUsed = canRedeem && redeemOn ? Math.max(0, Math.min(maxPoints, Math.floor(Number(redeemInput) || 0))) : 0;
  const pointsDeduction = roundCurrency(pointsUsed * pointValue);
  const cartTotal = roundCurrency(afterDiscount - pointsDeduction);
  const hasAdjustments = cartEmptyDeduction > 0 || discountAmount > 0 || pointsUsed > 0;
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
      if (!existing) return [...current, { product, quantity: 1, empties: 0 }];
      return current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
    });
    setBumpedId(product.id);
    window.setTimeout(() => setBumpedId((current) => (current === product.id ? null : current)), 360);
    return true;
  };

  // Selling by barcode: works from the search box (typed or scanned) and from anywhere on the page.
  const sellByBarcode = (rawCode: string) => {
    setShowReceipt(false); // scanning the next customer's bottle starts a new sale
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
      .map((line) => ({ ...line, empties: Math.min(line.empties, line.quantity) }))
      .filter((line) => line.quantity > 0));
  };

  const setEmpties = (productId: number, empties: number) => {
    setCart((current) => current.map((line) => line.product.id === productId
      ? { ...line, empties: Math.max(0, Math.min(line.quantity, empties)) }
      : line));
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
            emptiesReturned: line.empties,
          })),
          paymentMethod,
          amountReceived: paymentMethod === "CASH" ? tendered : undefined,
          ...(paymentMethod !== "CASH" && paymentReference.trim() ? { paymentReference: paymentReference.trim() } : {}),
          ...(member ? { customerId: member.id } : {}),
          ...(discountAmount > 0 ? { discount: { type: discountType, value: discountValue } } : {}),
          ...(pointsUsed > 0 ? { redeemPoints: pointsUsed } : {}),
        }),
      });
      const payload = await response.json().catch(() => null) as { data?: CheckoutResult; message?: string } | null;
      if (!response.ok || !payload?.data) {
        if (response.status === 422) void loadShift();
        throw new Error(payload?.message ?? "Checkout failed");
      }
      const sale = payload.data;
      // Receipt figures come from the server's record of the sale, not the screen's own maths.
      const productById = new Map(cart.map((line) => [line.product.id, line.product]));
      const receipt: SaleReceipt = {
        billNo: sale.invoiceGroupCode,
        soldAt: sale.counterSale?.createdAt ?? new Date().toISOString(),
        cashierName: admin.name,
        cashierRole: ROLE_LABELS[admin.role] ?? admin.role,
        member: sale.member ?? null,
        discount: sale.discount ?? null,
        pointsRedeemed: sale.pointsRedeemed ?? 0,
        pointsValue: sale.pointsValue ?? 0,
        paymentMethod: sale.paymentMethod,
        paymentReference: sale.paymentReference ?? null,
        lines: sale.purchases.map((line) => {
          const product = productById.get(line.productId);
          return {
            name: line.name,
            detail: [product?.brand.name, product?.compatibleWith].filter(Boolean).join(" · ") || undefined,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            empties: line.emptiesReturned ?? 0,
            emptyPrice: product ? emptyPriceOf(product) : 0,
            emptyDeduction: line.emptyDeduction ?? 0,
            total: line.lineTotal,
          };
        }),
        subtotal: sale.subtotal ?? sale.total,
        emptyDeduction: sale.emptyDeduction ?? 0,
        emptiesReturned: sale.emptiesReturned ?? 0,
        total: sale.total,
        amountReceived: sale.amountReceived,
        change: sale.changeGiven,
      };
      setCheckoutMessage(`Sale complete · ${sale.invoiceGroupCode}`);
      setCompletedReceipt(receipt);
      setShowReceipt(true);
      setMember(null);
      resetAdjustments();
      setCart([]);
      setAmountTendered("");
      setPaymentReference("");
      setPaymentMethod("CASH");
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
          {shift && <Link href="/dashboard/day-end" className="lx-shift-chip" title="Day End: expenses, drawer count and shift close"><IconClock /> {shift.shiftNo}</Link>}
          <span className="lx-scan-status" title="Scan a barcode anytime on this page to add it to the order"><i /> Scanner ready</span>
          {canManageStock && (
            <button type="button" className="btn-accent pos-add-liquor" onClick={() => setStockIn({})}>
              <IconBoxIn /> Add liquor
            </button>
          )}
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}
      {shift === null && (
        <form className="lx-shift-gate" onSubmit={(event) => { event.preventDefault(); void startShift(); }}>
          <div>
            <strong>No shift is open</strong>
            <span>Count the cash in the drawer (the float) and start a shift to sell. Everything sold is then balanced at Day End.</span>
          </div>
          {canStartShift ? (
            <div className="lx-shift-gate-form">
              <label>Float Rs.<input className="bm-input" type="number" min={0} step="0.01" value={suggestedFloat} onChange={(event) => setSuggestedFloat(event.target.value)} /></label>
              <button type="submit" className="btn-accent" disabled={startingShift}>{startingShift ? "Starting…" : "Start shift"}</button>
            </div>
          ) : <span className="lx-readonly-pill">Ask a cashier or manager to start a shift</span>}
        </form>
      )}
      {checkoutMessage && (
        <div className="pos-sale-success">
          <span className="check"><IconCheck size={20} /> {checkoutMessage}</span>
          {completedReceipt && (
            <span className="pos-sale-success-actions">
              <button type="button" onClick={() => setShowReceipt(true)}>View receipt</button>
              <button type="button" onClick={() => printReceipt(completedReceipt)}><IconPrinter size={15} /> Print again</button>
            </span>
          )}
        </div>
      )}

      <div ref={registerRef} className="pos-register-layout">
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
                    <span className="pos-product-tags">
                      <span className={`pos-stock${lowStock ? " low" : ""}`}>{product.quantity} in stock</span>
                      {emptyPriceOf(product) > 0 && <span className="pos-empty-tag">Empty {formatCurrency(emptyPriceOf(product))}</span>}
                    </span>
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
          {cart.length > 0 && <button type="button" onClick={() => { setCart([]); setAmountTendered(""); setMember(null); resetAdjustments(); }}>Clear</button>}
        </div>
        <MemberPicker token={token} member={member} pointValue={pointValue} onChange={changeMember} onAuthExpired={logout} />
        <div className="pos-cart-lines">
          {cart.length === 0 ? (
            <div className="pos-cart-empty"><IconCart size={38} /><strong>No items yet</strong><p>Scan a barcode or tap a product.</p></div>
          ) : cart.map((line) => (
            <div key={line.product.id} className="pos-cart-line">
              <ProductArt
                className="pos-cart-thumb"
                categoryName={line.product.category.name}
                imageUrl={((line.product.images ?? []).find((image) => image.isPrimary) ?? line.product.images?.[0])?.url}
                alt={line.product.name}
                iconSize={22}
              />
              <div className="pos-cart-line-main">
                <strong>{line.product.name}</strong>
                <span>{formatCurrency(line.product.sellingPrice)} each</span>
              </div>
              <div className="pos-cart-line-controls">
                <button type="button" onClick={() => changeCartQuantity(line.product.id, -1)} aria-label={`Remove one ${line.product.name}`}>−</button>
                <strong key={line.quantity}>{line.quantity}</strong>
                <button type="button" onClick={() => changeCartQuantity(line.product.id, 1)} disabled={line.quantity >= line.product.quantity} aria-label={`Add one ${line.product.name}`}>+</button>
              </div>
              {emptyPriceOf(line.product) > 0 && (
                <div className={`pos-empties${line.empties > 0 ? " active" : ""}`}>
                  <span className="pos-empties-label">
                    <IconBottle /> Empties given
                    <em>{formatCurrency(emptyPriceOf(line.product))} each</em>
                  </span>
                  <div className="pos-cart-line-controls">
                    <button type="button" onClick={() => setEmpties(line.product.id, line.empties - 1)} disabled={line.empties <= 0} aria-label={`One less empty ${line.product.name}`}>−</button>
                    <strong key={line.empties}>{line.empties}</strong>
                    <button type="button" onClick={() => setEmpties(line.product.id, line.empties + 1)} disabled={line.empties >= line.quantity} aria-label={`One more empty ${line.product.name}`}>+</button>
                  </div>
                  {line.empties < line.quantity && (
                    <button type="button" className="pos-empties-all" onClick={() => setEmpties(line.product.id, line.quantity)}>All {line.quantity}</button>
                  )}
                </div>
              )}
              <span className="pos-cart-line-total">
                {line.empties > 0 && <s>{formatCurrency((line.product.sellingPrice ?? 0) * line.quantity)}</s>}
                {formatCurrency((line.product.sellingPrice ?? 0) * line.quantity - emptyPriceOf(line.product) * line.empties)}
              </span>
            </div>
          ))}
        </div>

        <div className="pos-cart-checkout">
          {cart.length > 0 && (settings.discountsEnabled || canRedeem) && (
            <div className="pos-adjust">
              <div className="pos-adjust-toggles">
                {settings.discountsEnabled && (
                  <button type="button" className={discountOn ? "active" : ""} onClick={() => { setDiscountOn(!discountOn); if (discountOn) setDiscountInput(""); }}>
                    % Discount
                  </button>
                )}
                {canRedeem && (
                  <button type="button" className={`points${redeemOn ? " active" : ""}`} onClick={() => { const next = !redeemOn; setRedeemOn(next); setRedeemInput(next ? String(maxPoints) : ""); }}>
                    Use points <b>{member?.loyaltyPoints}</b>
                  </button>
                )}
              </div>

              {settings.discountsEnabled && discountOn && (
                <div className="pos-adjust-row">
                  <div className="pos-adjust-type" role="radiogroup" aria-label="Discount type">
                    <button type="button" role="radio" aria-checked={discountType === "PERCENT"} className={discountType === "PERCENT" ? "active" : ""} onClick={() => setDiscountType("PERCENT")}>%</button>
                    <button type="button" role="radio" aria-checked={discountType === "AMOUNT"} className={discountType === "AMOUNT" ? "active" : ""} onClick={() => setDiscountType("AMOUNT")}>Rs.</button>
                  </div>
                  <input
                    className="bm-input"
                    type="number"
                    min={0}
                    step={discountType === "PERCENT" ? "0.5" : "1"}
                    max={discountType === "PERCENT" ? 100 : afterEmpties}
                    value={discountInput}
                    onChange={(event) => setDiscountInput(event.target.value)}
                    placeholder={discountType === "PERCENT" ? "e.g. 5" : "e.g. 200"}
                    aria-label={discountType === "PERCENT" ? "Discount percentage" : "Discount amount in rupees"}
                    autoFocus
                  />
                  {discountType === "PERCENT" && (
                    <div className="pos-adjust-quick">
                      {[5, 10, 15].map((value) => <button key={value} type="button" onClick={() => setDiscountInput(String(value))}>{value}%</button>)}
                    </div>
                  )}
                </div>
              )}
              {discountOverLimit && (
                <div className="pos-adjust-warn">Cashiers can give up to {settings.maxCashierDiscountPercent}% — this is {discountPercentOfBill.toFixed(1)}%.</div>
              )}

              {canRedeem && redeemOn && (
                <div className="pos-adjust-row">
                  <span className="pos-adjust-label">Points</span>
                  <input
                    className="bm-input"
                    type="number"
                    min={0}
                    max={maxPoints}
                    step="1"
                    value={redeemInput}
                    onChange={(event) => setRedeemInput(event.target.value)}
                    aria-label="Points to use"
                  />
                  <span className="pos-adjust-hint">of {maxPoints} usable · 1 pt = {formatCurrency(pointValue)}</span>
                </div>
              )}
            </div>
          )}

          {hasAdjustments && (
            <div className="pos-cart-breakdown">
              <div><span>Subtotal</span><span>{formatCurrency(cartSubtotal)}</span></div>
              {cartEmptyDeduction > 0 && <div className="deduct"><span>Empty bottles returned ({cartEmptiesCount})</span><span>− {formatCurrency(cartEmptyDeduction)}</span></div>}
              {discountAmount > 0 && <div className="deduct discount"><span>Discount{discountType === "PERCENT" ? ` (${Math.min(discountValue, 100)}%)` : ""}</span><span>− {formatCurrency(discountAmount)}</span></div>}
              {pointsUsed > 0 && <div className="deduct points"><span>Loyalty points ({pointsUsed} pts)</span><span>− {formatCurrency(pointsDeduction)}</span></div>}
            </div>
          )}
          <div className="pos-cart-total"><span>Total</span><strong><AnimatedMoney value={cartTotal} /></strong></div>
          <div className="pos-payment-buttons three" aria-label="Payment method">
            <button type="button" className={paymentMethod === "CASH" ? "active" : ""} onClick={() => choosePayment("CASH")}><IconCash /> Cash</button>
            <button type="button" className={paymentMethod === "CARD" ? "active" : ""} onClick={() => choosePayment("CARD")}><IconCard /> Card</button>
            <button type="button" className={paymentMethod === "BANK_TRANSFER" ? "active" : ""} onClick={() => choosePayment("BANK_TRANSFER")}><IconQr /> Transfer / QR</button>
          </div>
          {paymentMethod !== "CASH" && cart.length > 0 && (
            <div className="pos-payref">
              <label htmlFor="payment-ref">{paymentMethod === "CARD" ? "Approval code" : "Transfer / QR reference"} <em>optional</em></label>
              <input id="payment-ref" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} maxLength={60} placeholder={paymentMethod === "CARD" ? "From the card slip, e.g. 004512" : "e.g. last 4 digits of the reference"} autoComplete="off" />
              <small>{paymentMethod === "CARD" ? "Charge the card on the machine first. The payment is recorded automatically and checked against the machine at Day End." : "Check the money arrived in the bank app before completing."}</small>
            </div>
          )}
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
          <button type="button" className="pos-complete-sale" disabled={cart.length === 0 || checkingOut || shift === null || discountOverLimit || (paymentMethod === "CASH" && tendered < cartTotal)} onClick={() => void checkout()}>
            {checkingOut ? "Completing…" : shift === null ? "Start a shift to sell" : `Complete sale · ${formatCurrency(cartTotal)}`}
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

      {showReceipt && completedReceipt && (
        <ReceiptModal
          receipt={completedReceipt}
          success
          title="Payment successful"
          subtitle={`${formatCurrency(completedReceipt.total)} · ${completedReceipt.paymentMethod === "CASH" ? `Change ${formatCurrency(completedReceipt.change)}` : completedReceipt.paymentMethod === "CARD" ? `Paid by card${completedReceipt.paymentReference ? ` · ${completedReceipt.paymentReference}` : ""}` : "Paid by transfer / QR"}${completedReceipt.member ? ` · +${completedReceipt.member.pointsEarned} pts for ${completedReceipt.member.name}` : ""}`}
          closeLabel="New sale"
          onClose={() => { setShowReceipt(false); searchInputRef.current?.focus(); }}
        />
      )}

      {stockIn && (
        <AddLiquorModal
          token={token}
          initialCode={stockIn.initialCode}
          onClose={() => setStockIn(null)}
          onStockChanged={(message) => {
            void loadData();
            if (message) {
              beep("ok");
              showToast({ kind: "ok", title: message, detail: "Ready to sell at the counter." });
            }
          }}
          onAuthExpired={logout}
        />
      )}
    </div>
  );
}
