"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdmin } from "../../components/AdminContext";
import TablePagination from "../../components/TablePagination";
import { API_URL } from "../../lib/constants";
import { useBranch } from "../../lib/useBranch";
import { buildGrnHtml, printGrn, type GrnRecord } from "../../lib/goodsPrint";
import { IconBoxInNav, IconCheck, IconClose, IconPlus, IconPrinter } from "../../lib/icons";

type Row = {
  id: number; grnNo: string; createdAt: string; branch: string; supplierName: string; poNumber: string | null; supplierInvoiceNo: string | null;
  invoiceTotal: number | null; totalCost: number; acceptedUnits: number; rejectedUnits: number; freeUnits?: number; lines: number; receivedBy: string;
};
type Setup = {
  suppliers: Array<{ id: number; name: string; code: string }>;
  orders: Array<{ id: number; poNumber: string; supplierId: number; status: string; orderDate: string; expectedDate: string | null; items: Array<{ id: number; productId: number | null; description: string; ordered: number; received: number; remaining: number; unitCost: number; freeQty?: number; freeDue?: number }> }>;
};
type Product = { id: number; name: string; compatibleWith: string | null; partNumber: string | null; purchasePrice: number | null; brand: { name: string }; supplierId?: number | null; supplier?: { id: number } | null };
type Line = { key: number; productId: string; purchaseOrderItemId: number | null; description: string; due: number | null; freeDue: number | null; delivered: string; rejected: string; rejectReason: string; free: string; unitCost: string };
type Api = <T>(path: string, init?: RequestInit) => Promise<T>;

const money = (value: number | null | undefined) => (value == null ? "—" : `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const when = (value: string) => new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
let lineKey = 1;
const blankLine = (): Line => ({ key: lineKey++, productId: "", purchaseOrderItemId: null, description: "", due: null, freeDue: null, delivered: "", rejected: "", rejectReason: "", free: "", unitCost: "" });

export default function GrnPage() {
  const { token, admin, logout } = useAdmin();
  const { state: branchState } = useBranch(token);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<{ cost: number; accepted: number; rejected: number } | null>(null);
  const [search, setSearch] = useState("");
  const [allBranches, setAllBranches] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<GrnRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const canCreate = admin?.role !== "ACCOUNTANT";

  const api: Api = useCallback(async <T,>(path: string, init?: RequestInit) => {
    const response = await fetch(`${API_URL}/api/pos${path}`, { ...init, headers, cache: "no-store" });
    if (response.status === 401) { logout(); throw new Error("Signed out"); }
    const payload = (await response.json().catch(() => ({}))) as { data?: T; message?: string; errors?: Record<string, string[]> };
    if (!response.ok) throw new Error((payload.errors && Object.values(payload.errors).flat()[0]) ?? payload.message ?? "Something went wrong");
    return payload.data as T;
  }, [headers, logout]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (search.trim()) params.set("search", search.trim());
    if (allBranches) params.set("branch", "all");
    try {
      const data = await api<{ rows: Row[]; total: number; totals: { cost: number; accepted: number; rejected: number } }>(`/grns?${params}`);
      setRows(data.rows); setTotal(data.total); setTotals(data.totals); setError(null);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load GRNs"); }
  }, [allBranches, api, page, pageSize, search]);
  useEffect(() => { void load(); }, [load]);

  const open = async (id: number) => {
    try { setViewing(await api<GrnRecord>(`/grns/${id}`)); } catch (openError) { setError(openError instanceof Error ? openError.message : "Could not open the GRN"); }
  };

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconBoxInNav /></div>
          <div>
            <h2 className="page-title">Goods Received (GRN)</h2>
            <p className="page-subtitle">Check in every supplier delivery at {branchState?.branch.name ?? "this branch"}: what came, what was rejected, and the supplier&apos;s invoice. Accepted goods go straight into this branch&apos;s stock.</p>
          </div>
        </div>
        {canCreate && <button type="button" className="btn-accent" onClick={() => setCreating(true)}><IconPlus /> New GRN</button>}
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="rt-kpis">
        <div className="rt-kpi"><span>GRNs</span><strong>{total}</strong><em>{allBranches ? "all branches" : branchState?.branch.name ?? ""}</em></div>
        <div className="rt-kpi"><span>Units accepted</span><strong>{totals?.accepted ?? "…"}</strong><em>into stock</em></div>
        <div className="rt-kpi warn"><span>Units rejected</span><strong>{totals?.rejected ?? "…"}</strong><em>sent back with the driver</em></div>
        <div className="rt-kpi"><span>Value received</span><strong style={{ fontSize: "1.25rem" }}>{money(totals?.cost)}</strong><em>at the cost entered</em></div>
      </div>

      <section className="lx-card lx-log-card">
        <div className="po-toolbar">
          <input className="bm-input" style={{ maxWidth: 360 }} placeholder="Search GRN, supplier, invoice, PO or item…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          {branchState?.canSwitch && (
            <label className="lx-check"><input type="checkbox" checked={allBranches} onChange={(event) => { setAllBranches(event.target.checked); setPage(1); }} /> All branches</label>
          )}
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>GRN</th><th>Date</th>{allBranches && <th>Branch</th>}<th>Supplier</th><th>PO</th><th>Invoice</th><th style={{ textAlign: "right" }}>Accepted</th><th style={{ textAlign: "right" }}>Rejected</th><th style={{ textAlign: "right" }}>Value</th><th>Received by</th></tr></thead>
            <tbody>
              {rows === null && <tr><td colSpan={10} className="bm-table-empty">Loading…</td></tr>}
              {rows?.length === 0 && <tr><td colSpan={10} className="bm-table-empty">No deliveries recorded yet. Use New GRN when a supplier delivers.</td></tr>}
              {rows?.map((row) => (
                <tr key={row.id} className="po-row" onClick={() => void open(row.id)}>
                  <td><strong>{row.grnNo}</strong></td>
                  <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{when(row.createdAt)}</td>
                  {allBranches && <td>{row.branch}</td>}
                  <td>{row.supplierName}</td>
                  <td className="td-muted">{row.poNumber ?? "—"}</td>
                  <td className="td-muted">{row.supplierInvoiceNo ?? "—"}{row.invoiceTotal != null && Math.abs(row.invoiceTotal - row.totalCost) >= 0.005 && <div className="lx-warn-text">Invoice {money(row.invoiceTotal)}</div>}</td>
                  <td style={{ textAlign: "right" }}>{row.acceptedUnits}{row.freeUnits ? <div className="lx-amount-in">+{row.freeUnits} free</div> : null}</td>
                  <td style={{ textAlign: "right" }} className={row.rejectedUnits ? "lx-amount-out" : ""}>{row.rejectedUnits || "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money(row.totalCost)}</td>
                  <td>{row.receivedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </section>

      {creating && <NewGrnModal api={api} branchName={branchState?.branch.name ?? "this branch"} onClose={() => setCreating(false)} onSaved={(grn) => { setCreating(false); setViewing(grn); setToast(`${grn.grnNo} saved — ${grn.acceptedUnits} unit(s) added to stock`); window.setTimeout(() => setToast(null), 3500); void load(); }} />}
      {viewing && (
        <div className="bm-modal-backdrop" onClick={() => setViewing(null)}>
          <div className="lx-report-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={viewing.grnNo}>
            <div className="lx-report-head">
              <div><strong>{viewing.grnNo} · {viewing.supplierName}</strong><span>{viewing.acceptedUnits} accepted · {viewing.rejectedUnits} rejected · {money(viewing.totalCost)}</span></div>
              <div className="lx-report-actions">
                <button type="button" className="btn-accent" onClick={() => printGrn(viewing)}><IconPrinter size={16} /> Print A4 / Save PDF</button>
                <button type="button" className="btn-outline" onClick={() => setViewing(null)}>Close</button>
              </div>
            </div>
            <iframe className="lx-report-frame" title="GRN preview" srcDoc={buildGrnHtml(viewing)} />
          </div>
        </div>
      )}
      {toast && <div className="lx-toasts"><div className="lx-toast ok"><span className="lx-toast-icon"><IconCheck size={16} /></span><div><strong>{toast}</strong></div></div></div>}
    </div>
  );
}

function NewGrnModal({ api, branchName, onClose, onSaved }: { api: Api; branchName: string; onClose: () => void; onSaved: (grn: GrnRecord) => void }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceTotal, setInvoiceTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<Setup>("/grns/setup").then(setSetup).catch((setupError: Error) => setError(setupError.message));
    void api<{ products: Product[] }>("/inventory-management/products?limit=5000").then((result) => setProducts(result.products)).catch(() => setProducts([]));
  }, [api]);

  const orders = setup?.orders.filter((order) => String(order.supplierId) === supplierId) ?? [];
  // Only the chosen supplier's products; others only when asked for (e.g. a product with no supplier set).
  const [showOthers, setShowOthers] = useState(false);
  const supplierOf = (product: Product) => product.supplierId ?? product.supplier?.id ?? null;
  const ownProducts = products.filter((product) => supplierId && String(supplierOf(product)) === supplierId);
  const listed = showOthers ? products : ownProducts;
  const supplierName = setup?.suppliers.find((item) => String(item.id) === supplierId)?.name ?? "the supplier";
  const pickOrder = (id: string) => {
    setOrderId(id);
    const order = setup?.orders.find((item) => String(item.id) === id);
    setLines(order
      ? order.items.map((item) => ({ ...blankLine(), productId: item.productId ? String(item.productId) : "", purchaseOrderItemId: item.id, description: item.description, due: item.remaining, delivered: String(item.remaining), freeDue: item.freeDue ?? 0, free: item.freeDue ? String(item.freeDue) : "", unitCost: String(item.unitCost) }))
      : [blankLine()]);
  };
  const setLine = (key: number, change: Partial<Line>) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)));
  const pickProduct = (key: number, id: string) => {
    const product = products.find((item) => String(item.id) === id);
    setLine(key, { productId: id, description: product ? [product.name, product.compatibleWith].filter(Boolean).join(" · ") : "", unitCost: product?.purchasePrice != null ? String(product.purchasePrice) : "" });
  };

  const counted = lines.map((line) => {
    const delivered = Math.max(0, Math.floor(Number(line.delivered) || 0));
    const rejected = Math.min(delivered, Math.max(0, Math.floor(Number(line.rejected) || 0)));
    const free = Math.max(0, Math.floor(Number(line.free) || 0));
    const amount = Math.round((delivered - rejected) * (Number(line.unitCost) || 0) * 100) / 100;
    // With a free issue, what's paid is spread over every bottle received.
    const costEach = delivered - rejected + free > 0 ? Math.round((amount / (delivered - rejected + free)) * 100) / 100 : 0;
    return { ...line, deliveredN: delivered, rejectedN: rejected, freeN: free, accepted: delivered - rejected, amount, costEach };
  });
  const freeTotal = counted.reduce((sum, line) => sum + line.freeN, 0);
  const freeValue = Math.round(counted.reduce((sum, line) => sum + line.freeN * (Number(line.unitCost) || 0), 0) * 100) / 100;
  const acceptedTotal = counted.reduce((sum, line) => sum + line.amount, 0);
  const invoiceNumber = invoiceTotal ? Number(invoiceTotal) : null;
  const invoiceDiff = invoiceNumber != null ? Math.round((invoiceNumber - acceptedTotal) * 100) / 100 : null;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      if (!supplierId) throw new Error("Choose the supplier");
      const grn = await api<GrnRecord>("/grns", {
        method: "POST",
        body: JSON.stringify({
          supplierId: Number(supplierId),
          purchaseOrderId: orderId ? Number(orderId) : null,
          supplierInvoiceNo: invoiceNo || null,
          invoiceDate: invoiceDate || null,
          invoiceTotal: invoiceNumber,
          notes: notes || null,
          lines: counted.filter((line) => line.deliveredN > 0 || line.freeN > 0).map((line) => ({
            productId: line.productId ? Number(line.productId) : null,
            purchaseOrderItemId: line.purchaseOrderItemId,
            description: line.description || undefined,
            delivered: line.deliveredN,
            rejected: line.rejectedN,
            free: line.freeN,
            rejectReason: line.rejectReason || null,
            unitCost: Number(line.unitCost) || 0,
          })),
        }),
      });
      onSaved(grn);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Could not save"); } finally { setBusy(false); }
  };

  return (
    <div className="bm-modal-backdrop">
      <form className="bm-modal po-modal" style={{ width: "min(1100px, 97vw)" }} onSubmit={(event: FormEvent) => { event.preventDefault(); void submit(); }} role="dialog" aria-label="New GRN">
        <div className="po-modal-head">
          <div><h3 className="bm-modal-title">New GRN · {branchName}</h3><p className="lx-card-sub">Count what the supplier delivered. Anything broken, short-dated or wrong goes in &quot;Rejected&quot; and back with the driver.</p></div>
          <button type="button" className="po-close" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <div className="lx-member-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <label>Supplier *
            <select className="bm-input" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); pickOrder(""); }} autoFocus>
              <option value="">Choose…</option>
              {setup?.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          <label>Against purchase order
            <select className="bm-input" value={orderId} onChange={(event) => pickOrder(event.target.value)} disabled={!supplierId}>
              <option value="">{orders.length ? "No — delivery without an order" : "No open orders for this supplier"}</option>
              {orders.map((order) => <option key={order.id} value={order.id}>{order.poNumber} · {order.items.reduce((sum, item) => sum + item.remaining, 0)} unit(s) still due</option>)}
            </select>
          </label>
          <label>Supplier invoice / delivery note no.<input className="bm-input" value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} placeholder="e.g. INV-2045" /></label>
          <label>Invoice date<input className="bm-input" type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} /></label>
          <label>Invoice total (Rs.)<input className="bm-input" type="number" min={0} step="0.01" value={invoiceTotal} onChange={(event) => setInvoiceTotal(event.target.value)} placeholder="To check against the goods" /></label>
          <label>Notes<input className="bm-input" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        </div>

        <div className="gd-lines">
          <div className="gd-line grn head"><span>Item</span><span className="num">Delivered</span><span className="num">Rejected</span><span className="num">Free</span><span className="num">Into stock</span><span>Why rejected</span><span className="num">Unit cost (Rs.)</span><span /></div>
          {counted.map((line) => (
            <div key={line.key} className="gd-line grn">
              <div>
                {line.purchaseOrderItemId ? <><strong>{line.description}</strong><small>{line.due} still due on the order{line.freeDue ? ` + ${line.freeDue} free` : ""}</small></> : (
                  <select className="bm-input" value={line.productId} onChange={(event) => pickProduct(line.key, event.target.value)} aria-label="Product" disabled={!supplierId}>
                    <option value="">{supplierId ? "Choose a product…" : "Choose the supplier first"}</option>
                    {listed.map((product) => <option key={product.id} value={product.id}>{[product.name, product.compatibleWith].filter(Boolean).join(" · ")} — {product.brand.name}</option>)}
                    {line.productId && !listed.some((product) => String(product.id) === line.productId) && (() => {
                      const current = products.find((product) => String(product.id) === line.productId);
                      return current ? <option value={current.id}>{[current.name, current.compatibleWith].filter(Boolean).join(" · ")} — {current.brand.name}</option> : null;
                    })()}
                  </select>
                )}
              </div>
              <input className="bm-input" type="number" min={0} value={line.delivered} onChange={(event) => setLine(line.key, { delivered: event.target.value })} aria-label="Delivered" />
              <input className="bm-input" type="number" min={0} value={line.rejected} placeholder="0" onChange={(event) => setLine(line.key, { rejected: event.target.value })} aria-label="Rejected" />
              <input className="bm-input gd-free" type="number" min={0} value={line.free} placeholder="0" onChange={(event) => setLine(line.key, { free: event.target.value })} aria-label="Free issue" title="Bottles given free (e.g. buy 10 get 2 free → 2)" />
              <span className="num"><strong>{line.accepted + line.freeN}</strong>{line.freeN > 0 && <small className="gd-free-note">{line.accepted} + {line.freeN} free · {money(line.costEach)} each</small>}{line.freeDue != null && line.freeDue > 0 && line.freeN < line.freeDue && <small className="lx-warn-text">{line.freeDue - line.freeN} free short</small>}</span>
              <input className="bm-input" value={line.rejectReason} disabled={!line.rejectedN} placeholder={line.rejectedN ? "Broken, leaking, short-dated…" : ""} onChange={(event) => setLine(line.key, { rejectReason: event.target.value })} aria-label="Why rejected" />
              <input className="bm-input" type="number" min={0} step="0.01" value={line.unitCost} onChange={(event) => setLine(line.key, { unitCost: event.target.value })} aria-label="Unit cost" />
              <button type="button" className="po-line-remove" onClick={() => setLines((current) => current.length > 1 ? current.filter((item) => item.key !== line.key) : current)} aria-label="Remove line"><IconClose /></button>
            </div>
          ))}
          {supplierId && !orderId && (
            <div className="po-supplier-note">
              {ownProducts.length === 0 ? <span>{supplierName} has no products yet — set the supplier on the product in Product Setup, or show other suppliers&apos; products.</span> : <span>Showing {supplierName}&apos;s {ownProducts.length} product(s).</span>}
              <label className="lx-check"><input type="checkbox" checked={showOthers} onChange={(event) => setShowOthers(event.target.checked)} /> Show other suppliers&apos; products</label>
            </div>
          )}
          <div><button type="button" className="btn-outline" onClick={() => setLines((current) => [...current, blankLine()])}><IconPlus /> Add item</button></div>
        </div>
        <div className="gd-foot">
          <span className="lx-card-sub">{counted.reduce((sum, line) => sum + line.accepted + line.freeN, 0)} unit(s) go into {branchName}&apos;s stock{freeTotal ? ` (incl. ${freeTotal} free, worth ${money(freeValue)})` : ""}{counted.some((line) => line.rejectedN) ? ` · ${counted.reduce((sum, line) => sum + line.rejectedN, 0)} rejected` : ""}</span>
          <span>Accepted value <b>{money(acceptedTotal)}</b></span>
        </div>
        {invoiceDiff != null && (Math.abs(invoiceDiff) < 0.005
          ? <div className="gd-ok">The supplier&apos;s invoice matches the goods accepted.</div>
          : <div className="gd-warn">The supplier&apos;s invoice is {money(Math.abs(invoiceDiff))} {invoiceDiff > 0 ? "more" : "less"} than the goods accepted — check it before paying (rejected items should come off the invoice).</div>)}
        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <div className="bm-modal-actions">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-accent" disabled={busy}>{busy ? "Saving…" : "Save GRN & add to stock"}</button>
        </div>
      </form>
    </div>
  );
}
