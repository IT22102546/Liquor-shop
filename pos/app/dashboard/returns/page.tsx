"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useAdmin } from "../../components/AdminContext";
import TablePagination from "../../components/TablePagination";
import { API_URL } from "../../lib/constants";
import { useShopSettings } from "../../lib/useShopSettings";
import { printReturnSlip, type ReturnRecord } from "../../lib/returnSlip";
import { IconCheck, IconClose, IconPrinter, IconReturns, IconSearch } from "../../lib/icons";

type ReturnType = ReturnRecord["type"];
type Product = { id: number; name: string; compatibleWith: string | null; partNumber: string | null; quantity: number; damagedQuantity?: number; sellingPrice: number | null; brand: { name: string } };
type Row = {
  id: number; returnNo: string; time: string; type: ReturnType; typeLabel: string; productId: number | null; product: string; quantity: number;
  condition: "SHELF" | "DAMAGED" | null; billNo: string | null; customer: string | null; mobile: string | null; unitPrice: number; refund: number;
  refundMethod: "CASH" | "WALLET" | null; pointsReversed: number; costValue: number | null; reason: string; note: string | null;
  disposal: string | null; disposalLabel: string | null; reference: string | null; shiftNo: string | null; by: string;
};
type Overview = {
  damagedStock: Array<{ productId: number; name: string; damaged: number; inStock: number; unitCost: number | null; value: number | null }>;
  damagedUnits: number; damagedValue: number;
  today: { exchanged: number; returned: number; refunds: number; refundCash: number; refundWallet: number; storeDamaged: number; cleared: number };
};
type BillHit = { billNo: string; time: string; total: number; cashier: string; customer: string; mobile: string | null; items: string };
type BillForReturn = {
  billNo: string; time: string; cashier: string; total: number; refundedSoFar: number; refundableLeft: number;
  member: { id: number; name: string; mobile: string; points: number } | null;
  pointsEarned: number; pointsReversedSoFar: number; pointsRate: number | null;
  lines: Array<{ productId: number; name: string; sold: number; returned: number; returnable: number; unitRefund: number }>;
};
type Modal = "exchange" | "refund" | "damage" | { clear: Overview["damagedStock"][number] } | null;
type Api = <T>(path: string, init?: RequestInit) => Promise<T>;

const TYPE_FILTERS: Array<{ value: ReturnType | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "EXCHANGE", label: "Exchanges" },
  { value: "REFUND", label: "Returns & refunds" },
  { value: "STORE_DAMAGE", label: "Store damage" },
  { value: "DAMAGE_CLEARED", label: "Cleared" },
];
const EXCHANGE_REASONS = ["Broken / cracked bottle", "Leaking", "Seal or cap broken", "Label damaged", "Spoiled / off taste"];
const DAMAGE_REASONS = ["Broken while stacking", "Cracked bottle found", "Leaking", "Seal or cap broken", "Dropped", "Expired / spoiled"];
const REFUND_REASONS = ["Unopened bottles not needed (sale or return)", "Bought by mistake", "Damaged bottle — money back"];
const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (value: string) => new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const productText = (product: Product) => [product.name, product.compatibleWith].filter(Boolean).join(" · ");

export default function ReturnsPage() {
  const { token, admin, logout } = useAdmin();
  const { settings } = useShopSettings(token);
  const isAdmin = admin?.role === "ADMIN";
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [tab, setTab] = useState<"history" | "damaged">("history");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [type, setType] = useState<ReturnType | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<string | null>(null);
  const shop = { name: settings.businessName, address: settings.businessAddress, phone: settings.businessPhone };

  const api: Api = useCallback(async <T,>(path: string, init?: RequestInit) => {
    const response = await fetch(`${API_URL}/api/pos${path}`, { ...init, headers, cache: "no-store" });
    if (response.status === 401) { logout(); throw new Error("Signed out"); }
    const payload = (await response.json().catch(() => ({}))) as { data?: T; message?: string; errors?: Record<string, string[]> };
    if (!response.ok) throw new Error((payload.errors && Object.values(payload.errors).flat()[0]) ?? payload.message ?? "Something went wrong");
    return payload.data as T;
  }, [headers, logout]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (type) params.set("type", type);
    if (search.trim()) params.set("search", search.trim());
    try {
      const [list, summary] = await Promise.all([api<{ total: number; rows: Row[] }>(`/returns?${params}`), api<Overview>("/returns/overview")]);
      setRows(list.rows);
      setTotal(list.total);
      setOverview(summary);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load returns");
    }
  }, [api, page, pageSize, search, type]);
  const loadProducts = useCallback(() => {
    void api<{ products: Product[] }>("/inventory-management/products?limit=5000").then((result) => setProducts(result.products)).catch(() => setProducts([]));
  }, [api]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const done = (record: ReturnRecord, message: string) => {
    setModal(null);
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
    void load();
    loadProducts();
    if (record.type === "EXCHANGE" || record.type === "REFUND") printReturnSlip(record, shop);
  };
  const reprint = async (returnNo: string) => {
    try { printReturnSlip(await api<ReturnRecord>(`/returns/${encodeURIComponent(returnNo)}`), shop); }
    catch (printError) { setError(printError instanceof Error ? printError.message : "Could not print"); }
  };

  // Lines of one return share a number; show the number, time and money only on its first line.
  const firstOfReturn = new Set<number>();
  rows?.forEach((row, index) => { if (index === 0 || rows[index - 1].returnNo !== row.returnNo) firstOfReturn.add(row.id); });

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconReturns /></div>
          <div>
            <h2 className="page-title">Returns &amp; Damages</h2>
            <p className="page-subtitle">Swap damaged bottles, take back unopened bottles and pay the money back, and keep damaged stock aside. Everything goes into the Day End book.</p>
          </div>
        </div>
        <div className="rt-actions">
          <button type="button" className="btn-accent" onClick={() => setModal("exchange")}>Damaged bottle exchange</button>
          <button type="button" className="btn-accent" onClick={() => setModal("refund")}>Return &amp; refund</button>
          <button type="button" className="btn-outline" onClick={() => setModal("damage")}>Mark store damage</button>
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="rt-kpis">
        <div className="rt-kpi"><span>Exchanged today</span><strong>{overview ? overview.today.exchanged : "…"}</strong><em>new bottles given for damaged ones</em></div>
        <div className="rt-kpi"><span>Returned today</span><strong>{overview ? overview.today.returned : "…"}</strong><em>{overview ? `${overview.today.refunds} refund(s) · cash ${money(overview.today.refundCash)}${overview.today.refundWallet ? ` · wallet ${money(overview.today.refundWallet)}` : ""}` : ""}</em></div>
        <div className="rt-kpi"><span>Store damage today</span><strong>{overview ? overview.today.storeDamaged : "…"}</strong><em>moved off the shelf</em></div>
        <div className="rt-kpi warn"><span>Damaged stock kept aside</span><strong>{overview ? overview.damagedUnits : "…"}</strong><em>{overview ? `worth ${money(overview.damagedValue)} at cost` : ""}</em></div>
      </div>

      <section className="lx-card lx-log-card">
        <div className="po-toolbar">
          <div className="lx-seg-plain" role="tablist">
            <button type="button" className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History <span className="po-count">{total}</span></button>
            <button type="button" className={tab === "damaged" ? "active" : ""} onClick={() => setTab("damaged")}>Damaged stock <span className="po-count">{overview?.damagedStock.length ?? 0}</span></button>
          </div>
          {tab === "history" && (
            <div className="po-filters">
              <select className="bm-input" value={type} onChange={(event) => { setType(event.target.value as ReturnType | ""); setPage(1); }} aria-label="Type">
                {TYPE_FILTERS.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
              </select>
              <input className="bm-input" placeholder="Search number, product, bill, customer…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            </div>
          )}
        </div>

        {tab === "history" ? (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Date</th><th>No.</th><th>What</th><th>Product</th><th style={{ textAlign: "right" }}>Qty</th><th>Bill / customer</th><th style={{ textAlign: "right" }}>Money</th><th>Reason</th><th>By</th><th /></tr></thead>
                <tbody>
                  {rows === null && <tr><td colSpan={10} className="bm-table-empty">Loading…</td></tr>}
                  {rows?.length === 0 && <tr><td colSpan={10} className="bm-table-empty">Nothing recorded yet. Exchanges, returns and damaged stock will be listed here.</td></tr>}
                  {rows?.map((row) => {
                    const first = firstOfReturn.has(row.id);
                    return (
                      <tr key={row.id} className={first ? "" : "rt-cont"}>
                        <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{first ? when(row.time) : ""}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{first ? <strong>{row.returnNo}</strong> : ""}</td>
                        <td>{first && <span className={`rt-type ${row.type}`}>{row.typeLabel}</span>}{row.disposalLabel && <div className="td-muted">{row.disposalLabel}</div>}</td>
                        <td>{row.product}{row.condition && <div className="td-muted">{row.condition === "SHELF" ? "Back on the shelf" : "Kept aside as damaged"}</div>}</td>
                        <td style={{ textAlign: "right" }}>{row.quantity}</td>
                        <td className="td-muted">{row.billNo ?? "—"}{row.customer && <div>{row.customer}{row.mobile ? ` · ${row.mobile}` : ""}</div>}</td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {row.type === "REFUND" ? <><span className="lx-amount-out">−{money(row.refund)}</span><div className="td-muted">{row.refundMethod === "WALLET" ? "to wallet" : "cash back"}{row.pointsReversed ? ` · −${row.pointsReversed} pts` : ""}</div></> : row.costValue != null && row.type !== "DAMAGE_CLEARED" ? <span className="td-muted">cost {money(row.costValue)}</span> : "—"}
                        </td>
                        <td>{row.reason}{row.note && <div className="td-muted">{row.note}</div>}{row.reference && <div className="td-muted">Ref: {row.reference}</div>}</td>
                        <td>{row.by}{row.shiftNo && <div className="td-muted">{row.shiftNo}</div>}</td>
                        <td>{first && <button type="button" className="btn-outline lx-row-btn" onClick={() => void reprint(row.returnNo)} title="Print slip"><IconPrinter size={15} /></button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
          </>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Product</th><th style={{ textAlign: "right" }}>Damaged, kept aside</th><th style={{ textAlign: "right" }}>Good stock on shelf</th><th style={{ textAlign: "right" }}>Cost each</th><th style={{ textAlign: "right" }}>Value at cost</th><th /></tr></thead>
              <tbody>
                {overview?.damagedStock.length === 0 && <tr><td colSpan={6} className="bm-table-empty">No damaged stock kept aside.</td></tr>}
                {overview?.damagedStock.map((row) => (
                  <tr key={row.productId}>
                    <td><strong>{row.name}</strong></td>
                    <td style={{ textAlign: "right" }}><span className="rt-damaged">{row.damaged}</span></td>
                    <td style={{ textAlign: "right" }}>{row.inStock}</td>
                    <td style={{ textAlign: "right" }}>{row.unitCost == null ? "—" : money(row.unitCost)}</td>
                    <td style={{ textAlign: "right" }}>{row.value == null ? "—" : money(row.value)}</td>
                    <td style={{ textAlign: "right" }}>{isAdmin ? <button type="button" className="btn-outline lx-row-btn" onClick={() => setModal({ clear: row })}>Clear…</button> : <span className="td-muted">Admin clears</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal === "exchange" && <ExchangeModal api={api} products={products} onClose={() => setModal(null)} onDone={(record) => done(record, `${record.returnNo}: exchange recorded`)} />}
      {modal === "damage" && <DamageModal api={api} products={products} onClose={() => setModal(null)} onDone={(record) => done(record, `${record.returnNo}: moved to damaged stock`)} />}
      {modal === "refund" && <RefundModal api={api} onClose={() => setModal(null)} onDone={(record) => done(record, `${record.returnNo}: ${money(record.refund)} paid back`)} />}
      {modal && typeof modal === "object" && <ClearModal api={api} item={modal.clear} onClose={() => setModal(null)} onDone={(record) => done(record, `${record.returnNo}: damaged stock cleared`)} />}

      {toast && <div className="lx-toasts"><div className="lx-toast ok"><span className="lx-toast-icon"><IconCheck size={16} /></span><div><strong>{toast}</strong></div></div></div>}
    </div>
  );
}

function ModalShell({ title, sub, onClose, onSubmit, busy, error, submitLabel, children }: {
  title: string; sub: string; onClose: () => void; onSubmit: () => void; busy: boolean; error: string | null; submitLabel: string; children: ReactNode;
}) {
  return (
    <div className="bm-modal-backdrop">
      <form className="bm-modal po-modal rt-modal" onSubmit={(event: FormEvent) => { event.preventDefault(); onSubmit(); }} role="dialog" aria-label={title}>
        <div className="po-modal-head">
          <div><h3 className="bm-modal-title">{title}</h3><p className="lx-card-sub">{sub}</p></div>
          <button type="button" className="po-close" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        {children}
        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <div className="bm-modal-actions">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-accent" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

/** Search by name, size or barcode (a scanner types the barcode and Enter). */
function ProductPicker({ products, value, onChange, stockOf }: { products: Product[]; value: Product | null; onChange: (product: Product | null) => void; stockOf: (product: Product) => string }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q ? products.filter((product) => `${productText(product)} ${product.brand.name} ${product.partNumber ?? ""}`.toLowerCase().includes(q)).slice(0, 8) : [];
  if (value) {
    return (
      <div className="rt-picked">
        <div><strong>{productText(value)}</strong><span>{value.brand.name} · {stockOf(value)}</span></div>
        <button type="button" className="btn-outline lx-row-btn" onClick={() => onChange(null)}>Change</button>
      </div>
    );
  }
  return (
    <div className="rt-picker">
      <div className="rt-search"><IconSearch /><input className="bm-input" autoFocus placeholder="Type a product name or scan the barcode" value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const exact = products.find((product) => product.partNumber && product.partNumber.toLowerCase() === q);
          if (exact || matches.length === 1) onChange(exact ?? matches[0]);
        }} /></div>
      {matches.length > 0 && (
        <div className="rt-matches">
          {matches.map((product) => (
            <button key={product.id} type="button" onClick={() => onChange(product)}>
              <strong>{productText(product)}</strong><span>{product.brand.name} · {stockOf(product)}</span>
            </button>
          ))}
        </div>
      )}
      {q && matches.length === 0 && <small className="td-muted">No product matches “{query}”.</small>}
    </div>
  );
}

function ReasonField({ reasons, value, onChange }: { reasons: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <label className="wide">What happened? *
      <div className="rt-chips">{reasons.map((reason) => <button key={reason} type="button" className={value === reason ? "active" : ""} onClick={() => onChange(reason)}>{reason}</button>)}</div>
      <input className="bm-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Pick one above or type the reason" />
    </label>
  );
}

function useSubmit(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try { await action(); } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Could not save"); } finally { setBusy(false); }
  };
  return { busy, error, setError, run };
}

function ExchangeModal({ api, products, onClose, onDone }: { api: Api; products: Product[]; onClose: () => void; onDone: (record: ReturnRecord) => void }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [billNo, setBillNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [note, setNote] = useState("");
  const submit = useSubmit(async () => {
    if (!product) throw new Error("Choose the product");
    const record = await api<ReturnRecord>("/returns/exchange", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: Number(quantity), reason, billNo: billNo || null, customerName: customerName || null, customerMobile: customerMobile || null, note: note || null }) });
    onDone(record);
  });
  return (
    <ModalShell title="Damaged bottle exchange" sub="The customer hands back a damaged bottle and gets a new one. The new bottle comes off the shelf; the damaged one is kept aside." onClose={onClose} onSubmit={() => void submit.run()} busy={submit.busy} error={submit.error} submitLabel="Record exchange & print slip">
      <ProductPicker products={products} value={product} onChange={setProduct} stockOf={(item) => `${item.quantity} on shelf`} />
      <div className="lx-member-grid">
        <label>Bottles exchanged *<input className="bm-input" type="number" min={1} max={product?.quantity ?? undefined} value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
        <label>Bill number (if they have it)<input className="bm-input" value={billNo} onChange={(event) => setBillNo(event.target.value)} placeholder="POS-…" /></label>
        <label>Customer name<input className="bm-input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
        <label>Mobile<input className="bm-input" value={customerMobile} onChange={(event) => setCustomerMobile(event.target.value)} inputMode="tel" /></label>
        <ReasonField reasons={EXCHANGE_REASONS} value={reason} onChange={setReason} />
        <label className="wide">Note<input className="bm-input" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      </div>
    </ModalShell>
  );
}

function DamageModal({ api, products, onClose, onDone }: { api: Api; products: Product[]; onClose: () => void; onDone: (record: ReturnRecord) => void }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const submit = useSubmit(async () => {
    if (!product) throw new Error("Choose the product");
    onDone(await api<ReturnRecord>("/returns/damage", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: Number(quantity), reason, note: note || null }) }));
  });
  return (
    <ModalShell title="Mark store damage" sub="Bottles found damaged in the store come off the shelf and are kept aside as damaged stock, until sent back to the supplier or thrown away." onClose={onClose} onSubmit={() => void submit.run()} busy={submit.busy} error={submit.error} submitLabel="Move to damaged stock">
      <ProductPicker products={products} value={product} onChange={setProduct} stockOf={(item) => `${item.quantity} on shelf${item.damagedQuantity ? ` · ${item.damagedQuantity} damaged` : ""}`} />
      <div className="lx-member-grid">
        <label>Damaged bottles *<input className="bm-input" type="number" min={1} max={product?.quantity ?? undefined} value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
        <span />
        <ReasonField reasons={DAMAGE_REASONS} value={reason} onChange={setReason} />
        <label className="wide">Note<input className="bm-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Where it was found, who found it…" /></label>
      </div>
    </ModalShell>
  );
}

function ClearModal({ api, item, onClose, onDone }: { api: Api; item: Overview["damagedStock"][number]; onClose: () => void; onDone: (record: ReturnRecord) => void }) {
  const [quantity, setQuantity] = useState(String(item.damaged));
  const [disposal, setDisposal] = useState<"SUPPLIER" | "WRITTEN_OFF" | "RESTORED">("SUPPLIER");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const submit = useSubmit(async () => {
    onDone(await api<ReturnRecord>("/returns/clear", { method: "POST", body: JSON.stringify({ productId: item.productId, quantity: Number(quantity), disposal, reason, reference: reference || null }) }));
  });
  const options = [
    { value: "SUPPLIER" as const, label: "Sent back to supplier", hint: "Supplier takes them back (credit or replacement)" },
    { value: "WRITTEN_OFF" as const, label: "Thrown away", hint: "Written off as a loss" },
    { value: "RESTORED" as const, label: "Put back on the shelf", hint: "Marked damaged by mistake — they are fine to sell" },
  ];
  return (
    <ModalShell title={`Clear damaged ${item.name}`} sub={`${item.damaged} damaged bottle(s) kept aside.`} onClose={onClose} onSubmit={() => void submit.run()} busy={submit.busy} error={submit.error} submitLabel="Clear damaged stock">
      <div className="rt-options">
        {options.map((option) => (
          <button key={option.value} type="button" className={disposal === option.value ? "active" : ""} onClick={() => setDisposal(option.value)}><strong>{option.label}</strong><span>{option.hint}</span></button>
        ))}
      </div>
      <div className="lx-member-grid">
        <label>Bottles *<input className="bm-input" type="number" min={1} max={item.damaged} value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
        <label>Reference<input className="bm-input" value={reference} onChange={(event) => setReference(event.target.value)} placeholder={disposal === "SUPPLIER" ? "Supplier return note / credit no." : ""} /></label>
        <label className="wide">Why / details *<input className="bm-input" value={reason} onChange={(event) => setReason(event.target.value)} required placeholder={disposal === "SUPPLIER" ? "Collected by the Lion rep" : disposal === "WRITTEN_OFF" ? "Broken glass, disposed" : "Checked again — not damaged"} /></label>
      </div>
    </ModalShell>
  );
}

function RefundModal({ api, onClose, onDone }: { api: Api; onClose: () => void; onDone: (record: ReturnRecord) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<BillHit[] | null>(null);
  const [bill, setBill] = useState<BillForReturn | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [conditions, setConditions] = useState<Record<number, "SHELF" | "DAMAGED">>({});
  const [method, setMethod] = useState<"CASH" | "WALLET">("CASH");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (bill) return;
    const timer = window.setTimeout(() => {
      void api<BillHit[]>(`/returns/bills${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ""}`).then(setHits).catch(() => setHits([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [api, bill, query]);

  const open = async (billNo: string) => {
    try {
      setLookupError(null);
      const found = await api<BillForReturn>(`/returns/bills/${encodeURIComponent(billNo)}`);
      setBill(found);
      setCounts({});
      setConditions({});
      setMethod("CASH");
    } catch (openError) { setLookupError(openError instanceof Error ? openError.message : "Bill not found"); }
  };

  const lines = bill?.lines.map((line) => {
    const quantity = Math.max(0, Math.min(line.returnable, Math.floor(Number(counts[line.productId]) || 0)));
    return { ...line, quantity, amount: Math.round(line.unitRefund * quantity * 100) / 100 };
  }) ?? [];
  const refund = Math.min(bill?.refundableLeft ?? 0, Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100);
  const pointsBack = bill?.member && bill.pointsRate ? Math.max(0, Math.min(Math.floor(refund / bill.pointsRate), bill.pointsEarned - bill.pointsReversedSoFar, bill.member.points)) : 0;

  const submit = useSubmit(async () => {
    if (!bill) throw new Error("Choose the bill");
    if (!lines.some((line) => line.quantity > 0)) throw new Error("Enter how many bottles came back");
    onDone(await api<ReturnRecord>("/returns/refund", {
      method: "POST",
      body: JSON.stringify({ billNo: bill.billNo, method, reason, note: note || null, lines: lines.filter((line) => line.quantity > 0).map((line) => ({ productId: line.productId, quantity: line.quantity, condition: conditions[line.productId] ?? "SHELF" })) }),
    }));
  });

  return (
    <ModalShell title="Return & refund" sub="Bottles bought on a bill are brought back (e.g. sale or return — the unused ones come back) and the money is paid back." onClose={onClose} onSubmit={() => void submit.run()} busy={submit.busy} error={submit.error ?? lookupError} submitLabel={bill ? `Pay back ${money(refund)} & print slip` : "Choose a bill first"}>
      {!bill ? (
        <div className="rt-picker">
          <div className="rt-search"><IconSearch /><input className="bm-input" autoFocus placeholder="Bill number (last few characters are enough) or member mobile" value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (hits?.length === 1) void open(hits[0].billNo); } }} /></div>
          <small className="td-muted">{query.trim() ? "Matching bills" : "Bills from the last 3 days"}</small>
          <div className="rt-bills">
            {hits === null && <div className="td-muted">Loading…</div>}
            {hits?.length === 0 && <div className="td-muted">No bills found.</div>}
            {hits?.map((hit) => (
              <button key={hit.billNo} type="button" onClick={() => void open(hit.billNo)}>
                <span><strong>{hit.billNo}</strong><em>{when(hit.time)} · {hit.cashier} · {hit.customer}{hit.mobile ? ` · ${hit.mobile}` : ""}</em><em>{hit.items}</em></span>
                <b>{money(hit.total)}</b>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="rt-picked">
            <div><strong>{bill.billNo}</strong><span>{when(bill.time)} · {bill.cashier} · {bill.member ? `${bill.member.name} (${bill.member.mobile})` : "Walk-in"} · bill {money(bill.total)}{bill.refundedSoFar ? ` · already refunded ${money(bill.refundedSoFar)}` : ""}</span></div>
            <button type="button" className="btn-outline lx-row-btn" onClick={() => setBill(null)}>Change bill</button>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Product</th><th style={{ textAlign: "right" }}>Bought</th><th style={{ textAlign: "right" }}>Can return</th><th style={{ textAlign: "right" }}>Refund each</th><th>Bottles back</th><th>Condition</th><th style={{ textAlign: "right" }}>Refund</th></tr></thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.productId}>
                    <td><strong>{line.name}</strong>{line.returned > 0 && <div className="td-muted">{line.returned} already returned</div>}</td>
                    <td style={{ textAlign: "right" }}>{line.sold}</td>
                    <td style={{ textAlign: "right" }}>{line.returnable}</td>
                    <td style={{ textAlign: "right" }}>{money(line.unitRefund)}</td>
                    <td><input className="bm-input rt-qty" type="number" min={0} max={line.returnable} disabled={line.returnable === 0} value={counts[line.productId] ?? ""} placeholder="0" onChange={(event) => setCounts({ ...counts, [line.productId]: event.target.value })} aria-label={`${line.name} bottles back`} /></td>
                    <td>
                      <select className="bm-input" value={conditions[line.productId] ?? "SHELF"} onChange={(event) => setConditions({ ...conditions, [line.productId]: event.target.value as "SHELF" | "DAMAGED" })} aria-label={`${line.name} condition`}>
                        <option value="SHELF">Unopened — back on shelf</option>
                        <option value="DAMAGED">Damaged — keep aside</option>
                      </select>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{line.quantity ? money(line.amount) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rt-refund-foot">
            <div className="lx-seg-plain" role="radiogroup" aria-label="Pay back by">
              <button type="button" className={method === "CASH" ? "active" : ""} onClick={() => setMethod("CASH")}>Cash from drawer</button>
              <button type="button" className={method === "WALLET" ? "active" : ""} disabled={!bill.member} onClick={() => setMethod("WALLET")} title={bill.member ? "" : "Walk-in bill — no wallet"}>Into member&apos;s wallet</button>
            </div>
            <div className="rt-refund-total"><span>Pay back</span><strong>{money(refund)}</strong>{pointsBack > 0 && <em>{pointsBack} point(s) earned on these bottles will be taken back</em>}</div>
          </div>
          <div className="lx-member-grid">
            <ReasonField reasons={REFUND_REASONS} value={reason} onChange={setReason} />
            <label className="wide">Note<input className="bm-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. party order — 6 of 24 came back" /></label>
          </div>
        </>
      )}
    </ModalShell>
  );
}
