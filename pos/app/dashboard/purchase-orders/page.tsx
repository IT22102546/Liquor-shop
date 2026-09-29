"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdmin } from "../../components/AdminContext";
import TablePagination from "../../components/TablePagination";
import { API_URL } from "../../lib/constants";
import { useShopSettings } from "../../lib/useShopSettings";
import { useBranch } from "../../lib/useBranch";
import { buildPurchaseOrderHtml, printPurchaseOrder, type PurchaseOrder } from "../../lib/purchaseOrderPrint";
import { IconCheck, IconClose, IconInvoice, IconPlus, IconPrinter, IconRefresh } from "../../lib/icons";

type Status = PurchaseOrder["status"];
type Supplier = { id: number; name: string; code: string; email: string | null; contactPerson: string | null };
type Product = { id: number; name: string; compatibleWith: string | null; purchasePrice: number | null; quantity: number; supplierId?: number | null; supplier?: { id: number } | null; brand: { name: string } };
type Row = {
  id: number; poNumber: string; supplier: { id: number; name: string; email: string | null }; branch: { id: number; name: string; code: string } | null; status: Status; statusLabel: string;
  orderDate: string; expectedDate: string | null; total: number; lines: number; units: number; receivedUnits: number;
  lastEmail: { status: "SENT" | "FAILED"; toEmail: string; createdAt: string } | null; createdBy: string;
};
type ListData = { orders: Row[]; counts: Record<string, { count: number; total: number }>; pagination: { total: number } };

const STATUS_TABS: Array<{ value: Status | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PARTIAL", label: "Part received" },
  { value: "RECEIVED", label: "Received" },
  { value: "CANCELLED", label: "Cancelled" },
];
const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (value: string | null) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const when = (value: string | null) => (value ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export default function PurchaseOrdersPage() {
  const { token, logout } = useAdmin();
  // Where the admin is working: from the main branch they can order for any branch.
  const { branch: working } = useBranch(token);
  const [branches, setBranches] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const { settings } = useShopSettings(token);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [data, setData] = useState<ListData | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [mail, setMail] = useState<{ configured: boolean; sender: string | null } | null>(null);
  const [status, setStatus] = useState<Status | "">("");
  const [supplierFilter, setSupplierFilter] = useState("");
  // Main branch only: see one branch's orders (a sub branch always sees just its own).
  const [branchFilter, setBranchFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PurchaseOrder | "new" | null>(null);
  const [viewing, setViewing] = useState<PurchaseOrder | null>(null);
  const [startWithSend, setStartWithSend] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const api = useCallback(async <T,>(path: string, init?: RequestInit) => {
    const response = await fetch(`${API_URL}/api/pos${path}`, { ...init, headers, cache: "no-store" });
    if (response.status === 401) { logout(); throw new Error("Signed out"); }
    const payload = (await response.json().catch(() => ({}))) as { data?: T; message?: string; errors?: Record<string, string[]> };
    if (!response.ok) throw new Error((payload.errors && Object.values(payload.errors)[0]?.[0]) ?? payload.message ?? "Something went wrong");
    return payload.data as T;
  }, [headers, logout]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (status) params.set("status", status);
    if (supplierFilter) params.set("supplierId", supplierFilter);
    if (branchFilter) params.set("branchId", branchFilter);
    if (search.trim()) params.set("search", search.trim());
    try {
      setData(await api<ListData>(`/purchase-orders?${params}`));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load purchase orders");
    }
  }, [api, page, pageSize, search, status, supplierFilter, branchFilter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void api<Supplier[]>("/inventory-management/suppliers").then(setSuppliers).catch(() => setSuppliers([]));
    void api<Array<{ id: number; name: string; code: string }>>("/branches").then(setBranches).catch(() => setBranches([]));
    void api<{ products: Product[] }>("/inventory-management/products?limit=5000").then((result) => setProducts(result.products)).catch(() => setProducts([]));
    void api<{ configured: boolean; sender: string | null }>("/purchase-orders/email-status").then(setMail).catch(() => setMail(null));
  }, [api]);

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 3200); };
  const openOrder = async (id: number) => {
    setStartWithSend(false);
    try { setViewing(await api<PurchaseOrder>(`/purchase-orders/${id}`)); } catch (openError) { setError(openError instanceof Error ? openError.message : "Could not open the order"); }
  };
  const countOf = (value: Status | "") => (value ? data?.counts[value]?.count ?? 0 : Object.values(data?.counts ?? {}).reduce((sum, row) => sum + row.count, 0));

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconInvoice /></div>
          <div>
            <h2 className="page-title">Purchase Orders</h2>
            <p className="page-subtitle">Order stock from suppliers, email the order, and receive the delivery into stock. Every step is recorded.{working && !working.isMain ? ` Showing ${working.name}'s orders only.` : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn-outline" onClick={() => void load()}><IconRefresh size={16} /> Refresh</button>
          <button type="button" className="btn-accent" onClick={() => setEditing("new")}><IconPlus /> New purchase order</button>
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}
      {mail && !mail.configured && (
        <div className="po-mail-warn">
          <strong>Email isn&apos;t set up yet</strong>
          <span>You can create, print and receive orders now. To email them to suppliers, the shop&apos;s mailbox (SMTP) must be added to the server settings.</span>
        </div>
      )}

      <section className="lx-card lx-log-card">
        <div className="po-toolbar">
          <div className="lx-seg-plain" role="tablist" aria-label="Order status">
            {STATUS_TABS.map((tab) => (
              <button key={tab.value || "all"} type="button" role="tab" aria-selected={status === tab.value} className={status === tab.value ? "active" : ""} onClick={() => { setStatus(tab.value); setPage(1); }}>
                {tab.label} <span className="po-count">{countOf(tab.value)}</span>
              </button>
            ))}
          </div>
          <div className="po-filters">
            {working?.isMain && branches.length > 1 && (
              <select id="po-branch-filter" className="bm-input" value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setPage(1); }} aria-label="Branch">
                <option value="">All branches</option>
                {branches.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            )}
            <select id="po-supplier-filter" className="bm-input" value={supplierFilter} onChange={(event) => { setSupplierFilter(event.target.value); setPage(1); }}>
              <option value="">All suppliers</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <input id="po-search" className="bm-input" placeholder="Search PO number, supplier or item" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>PO no</th><th>Branch</th><th>Supplier</th><th>Order date</th><th>Deliver by</th><th style={{ textAlign: "right" }}>Items</th><th style={{ textAlign: "right" }}>Total</th><th>Status</th><th>Email</th></tr>
            </thead>
            <tbody>
              {!data && <tr><td colSpan={9} className="bm-table-empty">Loading…</td></tr>}
              {data?.orders.length === 0 && <tr><td colSpan={9} className="bm-table-empty">{status || supplierFilter || branchFilter || search ? "No purchase orders match." : "No purchase orders yet. Create one with New purchase order."}</td></tr>}
              {data?.orders.map((row) => (
                <tr key={row.id} className="po-row" onClick={() => void openOrder(row.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") void openOrder(row.id); }}>
                  <td><strong>{row.poNumber}</strong><div className="td-muted">by {row.createdBy}</div></td>
                  <td><span className="po-branch">{row.branch?.name ?? "—"}</span></td>
                  <td>{row.supplier.name}</td>
                  <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{day(row.orderDate)}</td>
                  <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{day(row.expectedDate)}</td>
                  <td style={{ textAlign: "right" }}>{row.units}<div className="td-muted">{row.lines} line{row.lines === 1 ? "" : "s"}{row.receivedUnits ? ` · ${row.receivedUnits} in` : ""}</div></td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}><strong>{money(row.total)}</strong></td>
                  <td><span className={`po-status ${row.status}`}>{row.statusLabel}</span></td>
                  <td className="td-muted" style={{ whiteSpace: "nowrap" }}>
                    {row.lastEmail ? <><span className={row.lastEmail.status === "SENT" ? "lx-ok-text" : "lx-warn-text"}>{row.lastEmail.status === "SENT" ? "Sent" : "Failed"}</span> {when(row.lastEmail.createdAt)}</> : "Not sent"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={data?.pagination.total ?? 0} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </section>

      {editing && (
        <OrderEditor
          order={editing === "new" ? null : editing}
          working={working ? { id: working.id, name: working.name, isMain: working.isMain } : null}
          branches={branches}
          suppliers={suppliers}
          products={products}
          api={api}
          onClose={() => setEditing(null)}
          onSaved={(order, andSend) => { setEditing(null); flash(`${order.poNumber} saved`); void load(); setStartWithSend(andSend); setViewing(order); }}
        />
      )}
      {viewing && (
        <OrderView
          order={viewing}
          api={api}
          mailReady={Boolean(mail?.configured)}
          startWithSend={startWithSend}
          shopName={settings.businessName}
          onPrint={() => printPurchaseOrder(viewing, settings)}
          previewHtml={buildPurchaseOrderHtml(viewing, settings)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
          onChanged={(order, message) => { setViewing(order); flash(message); void load(); }}
          onClose={() => { setViewing(null); setStartWithSend(false); }}
        />
      )}
      {toast && <div className="lx-toasts"><div className="lx-toast ok"><span className="lx-toast-icon"><IconCheck size={16} /></span><div><strong>{toast}</strong></div></div></div>}
    </div>
  );
}

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
type Line = { key: number; productId: string; description: string; quantity: string; free: string; unitCost: string };
let lineKey = 1;
const blankLine = (): Line => ({ key: lineKey++, productId: "", description: "", quantity: "1", free: "", unitCost: "" });

function OrderEditor({ order, working, branches, suppliers, products, api, onClose, onSaved }: {
  order: PurchaseOrder | null; working: { id: number; name: string; isMain: boolean } | null; branches: Array<{ id: number; name: string; code: string }>;
  suppliers: Supplier[]; products: Product[]; api: Api;
  onClose: () => void; onSaved: (order: PurchaseOrder, andSend: boolean) => void;
}) {
  const [supplierId, setSupplierId] = useState(order ? String(order.supplier.id) : "");
  // Only the main branch can order for another branch; elsewhere the order is for the branch you're in.
  const canChooseBranch = working?.isMain === true;
  const [branchId, setBranchId] = useState(String(order?.branchId ?? order?.deliverTo?.id ?? working?.id ?? ""));
  useEffect(() => { if (!branchId && working) setBranchId(String(working.id)); }, [branchId, working]);
  const forBranch = branches.find((row) => String(row.id) === branchId) ?? (working && String(working.id) === branchId ? working : null);
  const [expectedDate, setExpectedDate] = useState(order?.expectedDate ? order.expectedDate.slice(0, 10) : "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(() => order
    ? order.items.map((item) => ({ key: lineKey++, productId: item.productId ? String(item.productId) : "", description: item.description, quantity: String(item.quantity), free: item.freeQty ? String(item.freeQty) : "", unitCost: String(item.unitCost) }))
    : [blankLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supplier = suppliers.find((row) => String(row.id) === supplierId);
  const supplierOf = (product: Product) => product.supplierId ?? product.supplier?.id ?? null;
  // Only the chosen supplier's products are listed; others only when asked for (e.g. a product with no supplier set).
  const [showOthers, setShowOthers] = useState(false);
  const ownProducts = products.filter((product) => supplierId && String(supplierOf(product)) === supplierId);
  const otherProducts = showOthers ? products.filter((product) => !(supplierId && String(supplierOf(product)) === supplierId)) : [];
  const label = (product: Product) => `${product.name}${product.compatibleWith ? ` · ${product.compatibleWith}` : ""} (${product.brand.name}) — ${product.quantity} in stock`;
  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0);

  const setLine = (key: number, patch: Partial<Line>) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const pickProduct = (key: number, productId: string) => {
    const product = products.find((row) => String(row.id) === productId);
    setLine(key, {
      productId,
      description: product ? [product.name, product.compatibleWith].filter(Boolean).join(" · ") : "",
      ...(product?.purchasePrice ? { unitCost: String(Math.round(product.purchasePrice * 100) / 100) } : {}),
    });
  };

  const submit = async (andSend: boolean) => {
    if (!supplierId) { setError("Choose a supplier"); return; }
    const items = lines
      .filter((line) => line.productId || line.description.trim())
      .map((line) => ({ productId: line.productId ? Number(line.productId) : null, description: line.description.trim() || undefined, quantity: Math.floor(Number(line.quantity)), freeQty: Math.max(0, Math.floor(Number(line.free) || 0)), unitCost: Number(line.unitCost || 0) }));
    if (items.length === 0) { setError("Add at least one item"); return; }
    if (items.some((item) => !(item.quantity >= 1))) { setError("Every line needs a quantity of at least 1"); return; }
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({ supplierId: Number(supplierId), branchId: branchId ? Number(branchId) : null, expectedDate: expectedDate || null, notes: notes.trim() || null, items });
      const saved = order
        ? await api<PurchaseOrder>(`/purchase-orders/${order.id}`, { method: "PATCH", body })
        : await api<PurchaseOrder>("/purchase-orders", { method: "POST", body });
      onSaved(saved, andSend);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bm-modal-backdrop">
      <form className="bm-modal po-modal" onSubmit={(event: FormEvent) => { event.preventDefault(); void submit(false); }} role="dialog" aria-label={order ? `Edit ${order.poNumber}` : "New purchase order"}>
        <div className="po-modal-head">
          <h3 className="bm-modal-title">{order ? `Edit ${order.poNumber}` : "New purchase order"}</h3>
          <button type="button" className="po-close" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <div className="lx-member-grid">
          <label>Supplier *
            <select id="po-supplier" className="bm-input" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} autoFocus={!order}>
              <option value="">Choose a supplier…</option>
              {suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}{row.email ? "" : " (no email)"}</option>)}
            </select>
            {supplier && !supplier.email && <small className="lx-warn-text">This supplier has no email address. Add it under Suppliers to email the order.</small>}
            {supplier?.email && <small>Will be emailed to {supplier.email}</small>}
          </label>
          <label>Order for branch *
            {canChooseBranch ? (
              <select id="po-branch" className="bm-input" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                {branches.map((row) => <option key={row.id} value={row.id}>{row.name}{row.id === working?.id ? " (this branch)" : ""}</option>)}
              </select>
            ) : (
              <input className="bm-input" value={forBranch?.name ?? working?.name ?? ""} readOnly aria-readonly="true" />
            )}
            <small>{canChooseBranch ? "The goods go to this branch, and it receives them on a GRN." : "Orders from this branch are for this branch. The main branch can order for any branch."}</small>
          </label>
          <label>Deliver by
            <input id="po-expected" className="bm-input" type="date" value={expectedDate} min={new Date().toLocaleDateString("en-CA")} onChange={(event) => setExpectedDate(event.target.value)} />
          </label>
        </div>

        <div className="po-lines">
          <div className="po-line head"><span>Product</span><span>Qty + free</span><span>Unit price (Rs.)</span><span>Amount</span><span /></div>
          {lines.map((line, index) => (
            <div key={line.key} className="po-line">
              <div className="po-line-product">
                <select id={`po-product-${line.key}`} className="bm-input" value={line.productId} onChange={(event) => pickProduct(line.key, event.target.value)} aria-label={`Line ${index + 1} product`}>
                  <option value="">{supplierId ? "Other item (type below)" : "Choose the supplier first"}</option>
                  {ownProducts.length > 0 && <optgroup label={`${supplier?.name ?? "Supplier"}'s products`}>{ownProducts.map((product) => <option key={product.id} value={product.id}>{label(product)}</option>)}</optgroup>}
                  {otherProducts.length > 0 && <optgroup label="Other suppliers' products">{otherProducts.map((product) => <option key={product.id} value={product.id}>{label(product)}</option>)}</optgroup>}
                  {/* Keep a product already on the line visible even if it isn't this supplier's. */}
                  {line.productId && !ownProducts.some((product) => String(product.id) === line.productId) && !otherProducts.some((product) => String(product.id) === line.productId) && (() => {
                    const current = products.find((product) => String(product.id) === line.productId);
                    return current ? <option value={current.id}>{label(current)}</option> : null;
                  })()}
                </select>
                {line.productId && supplierId && (() => {
                  const current = products.find((product) => String(product.id) === line.productId);
                  return current && String(supplierOf(current)) !== supplierId ? <small className="lx-warn-text">Not {supplier?.name}&apos;s product</small> : null;
                })()}
                {!line.productId && <input id={`po-desc-${line.key}`} className="bm-input" value={line.description} onChange={(event) => setLine(line.key, { description: event.target.value })} placeholder="Describe the item, e.g. Ice cubes 5kg bags" />}
              </div>
              <div className="po-qty-free">
                <input id={`po-qty-${line.key}`} className="bm-input" type="number" min={1} step="1" value={line.quantity} onChange={(event) => setLine(line.key, { quantity: event.target.value })} aria-label={`Line ${index + 1} quantity`} />
                <input id={`po-free-${line.key}`} className="bm-input gd-free" type="number" min={0} step="1" value={line.free} placeholder="+ free" onChange={(event) => setLine(line.key, { free: event.target.value })} aria-label={`Line ${index + 1} free issue`} title="Free issue from the supplier, e.g. buy 10 get 2 free → 2" />
              </div>
              <input id={`po-cost-${line.key}`} className="bm-input" type="number" min={0} step="0.01" value={line.unitCost} onChange={(event) => setLine(line.key, { unitCost: event.target.value })} placeholder="0.00" aria-label={`Line ${index + 1} unit price`} />
              <strong className="po-line-amount">{money((Number(line.quantity) || 0) * (Number(line.unitCost) || 0))}</strong>
              <button type="button" className="po-line-remove" onClick={() => setLines((current) => (current.length > 1 ? current.filter((row) => row.key !== line.key) : [blankLine()]))} aria-label={`Remove line ${index + 1}`}><IconClose /></button>
            </div>
          ))}
          {supplierId && (
            <div className="po-supplier-note">
              {ownProducts.length === 0 ? <span>{supplier?.name} has no products yet — set the supplier on the product in Product Setup, or show other suppliers&apos; products.</span> : <span>Showing {supplier?.name}&apos;s {ownProducts.length} product(s).</span>}
              <label className="lx-check"><input type="checkbox" checked={showOthers} onChange={(event) => setShowOthers(event.target.checked)} /> Show other suppliers&apos; products</label>
            </div>
          )}
          <div className="po-lines-foot">
            <button type="button" className="btn-outline btn-sm" onClick={() => setLines((current) => [...current, blankLine()])}><IconPlus /> Add item</button>
            <span>Total <strong>{money(total)}</strong></span>
          </div>
        </div>

        <label className="po-notes">Notes for the supplier
          <textarea id="po-notes" className="bm-input" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Deliver before 10 am. Call on arrival." />
        </label>
        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <div className="bm-modal-actions">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn-outline" disabled={saving}>{saving ? "Saving…" : "Save draft"}</button>
          <button type="button" className="btn-accent" disabled={saving} onClick={() => void submit(true)}>Save &amp; email supplier</button>
        </div>
      </form>
    </div>
  );
}

function OrderView({ order, api, mailReady, startWithSend, shopName, onPrint, previewHtml, onEdit, onChanged, onClose }: {
  order: PurchaseOrder; api: Api; mailReady: boolean; startWithSend: boolean; shopName: string; onPrint: () => void; previewHtml: string;
  onEdit: () => void; onChanged: (order: PurchaseOrder, message: string) => void; onClose: () => void;
}) {
  const [panel, setPanel] = useState<"send" | "receive" | "cancel" | "preview" | null>(startWithSend ? "send" : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mail, setMail] = useState({ to: order.emailDefaults.to, cc: "", subject: order.emailDefaults.subject, message: order.emailDefaults.message });
  const [receive, setReceive] = useState<Record<number, { quantity: string; unitCost: string; rejected?: string; reason?: string; free?: string }>>({});
  const [invoice, setInvoice] = useState({ no: "", date: "", total: "" });
  const [reason, setReason] = useState("");
  const open = order.status !== "CANCELLED" && order.status !== "RECEIVED";
  const sentOk = order.emails.some((email) => email.status === "SENT");

  useEffect(() => {
    setMail({ to: order.emailDefaults.to, cc: "", subject: order.emailDefaults.subject, message: order.emailDefaults.message });
    setReceive(Object.fromEntries(order.items.map((item) => [item.id, { quantity: String(item.remaining), unitCost: String(item.unitCost), free: item.freeDue ? String(item.freeDue) : "" }])));
  }, [order]);

  const run = async (action: () => Promise<PurchaseOrder>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      setPanel(null);
      onChanged(updated, message);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Something went wrong");
      // A failed email is still recorded, so refresh the history.
      if (panel === "send") void api<PurchaseOrder>(`/purchase-orders/${order.id}`).then((fresh) => onChanged(fresh, "Email not sent — see the email history")).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const send = () => run(() => api<PurchaseOrder>(`/purchase-orders/${order.id}/send`, { method: "POST", body: JSON.stringify({ to: mail.to.trim(), cc: mail.cc.trim(), subject: mail.subject.trim(), message: mail.message }) }), `${order.poNumber} emailed to ${mail.to.trim()}`);
  const doReceive = () => run(() => api<PurchaseOrder>(`/purchase-orders/${order.id}/receive`, {
    method: "POST",
    body: JSON.stringify({
      supplierInvoiceNo: invoice.no || null,
      invoiceDate: invoice.date || null,
      invoiceTotal: invoice.total ? Number(invoice.total) : null,
      lines: order.items.filter((item) => item.remaining > 0 || (item.freeDue ?? 0) > 0).map((item) => ({
        itemId: item.id,
        quantity: Math.floor(Number(receive[item.id]?.quantity || 0)),
        rejected: Math.floor(Number(receive[item.id]?.rejected || 0)),
        free: Math.floor(Number(receive[item.id]?.free || 0)),
        rejectReason: receive[item.id]?.reason || null,
        unitCost: Number(receive[item.id]?.unitCost || item.unitCost),
      })),
    }),
  }), `Stock received for ${order.poNumber} — GRN saved`);
  const cancel = () => run(() => api<PurchaseOrder>(`/purchase-orders/${order.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) }), `${order.poNumber} cancelled`);

  return (
    <div className="bm-modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="bm-modal po-modal po-view" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={order.poNumber}>
        <div className="po-modal-head">
          <div>
            <h3 className="bm-modal-title">{order.poNumber} <span className={`po-status ${order.status}`}>{order.statusLabel}</span></h3>
            <p className="lx-card-sub">{order.supplier.name}{order.supplier.email ? ` · ${order.supplier.email}` : " · no email address"} · ordered {day(order.orderDate)}{order.expectedDate ? ` · deliver by ${day(order.expectedDate)}` : ""}{order.deliverTo ? ` · to ${order.deliverTo.name}` : ""}</p>
          </div>
          <button type="button" className="po-close" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>

        <div className="po-actions">
          {order.status === "DRAFT" && <button type="button" className="btn-outline" onClick={onEdit}>Edit</button>}
          {order.status !== "CANCELLED" && (
            <button type="button" className="btn-accent" onClick={() => { setPanel("send"); setError(null); }}>{sentOk ? "Email again" : "Send email"}</button>
          )}
          <button type="button" className="btn-outline" onClick={() => setPanel(panel === "preview" ? null : "preview")}>{panel === "preview" ? "Hide preview" : "Preview"}</button>
          <button type="button" className="btn-outline" onClick={onPrint}><IconPrinter size={16} /> Print / PDF</button>
          {open && <button type="button" className="btn-outline" onClick={() => { setPanel("receive"); setError(null); }}>Receive stock</button>}
          {open && <button type="button" className="btn-outline po-danger" onClick={() => { setPanel("cancel"); setError(null); }}>Cancel order</button>}
        </div>

        {error && <div className="bm-alert bm-alert-error">{error}</div>}

        {panel === "preview" && <iframe className="po-preview" title="Purchase order preview" srcDoc={previewHtml} />}

        {panel === "send" && (
          <form className="po-panel" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <h4>Email {order.poNumber} to {order.supplier.name}</h4>
            {!mailReady && <div className="po-mail-warn small"><strong>Email isn&apos;t set up on the server yet.</strong><span>The attempt will be recorded, but it won&apos;t reach the supplier until the shop&apos;s mailbox is set up.</span></div>}
            <div className="lx-member-grid">
              <label>To *<input id="po-mail-to" className="bm-input" type="text" value={mail.to} onChange={(event) => setMail({ ...mail, to: event.target.value })} placeholder="supplier@example.com" /></label>
              <label>Copy to<input id="po-mail-cc" className="bm-input" type="text" value={mail.cc} onChange={(event) => setMail({ ...mail, cc: event.target.value })} placeholder="optional, separate with commas" /></label>
              <label className="wide">Subject *<input id="po-mail-subject" className="bm-input" value={mail.subject} onChange={(event) => setMail({ ...mail, subject: event.target.value })} /></label>
              <label className="wide">Message<textarea id="po-mail-message" className="bm-input" rows={6} value={mail.message} onChange={(event) => setMail({ ...mail, message: event.target.value })} /></label>
            </div>
            <small className="lx-card-sub">The full order (items, quantities, prices and total) is added below your message, with {shopName}&apos;s details at the top.</small>
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setPanel(null)} disabled={busy}>Back</button>
              <button type="submit" className="btn-accent" disabled={busy || !mail.to.trim()}>{busy ? "Sending…" : "Send email"}</button>
            </div>
          </form>
        )}

        {panel === "receive" && (
          <form className="po-panel" onSubmit={(event) => { event.preventDefault(); void doReceive(); }}>
            <h4>Receive the delivery into stock (GRN)</h4>
            <p className="lx-card-sub">Enter what was accepted, and anything rejected (broken, wrong or short-dated — it goes back with the driver). A GRN is saved{order.deliverTo ? ` at ${order.deliverTo.name}` : ""}, stock and cost prices update straight away, and the Day End book shows it. If the rest won&apos;t come, cancel the order to close it.</p>
            <div className="lx-member-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <label>Supplier invoice no.<input className="bm-input" value={invoice.no} onChange={(event) => setInvoice({ ...invoice, no: event.target.value })} placeholder="e.g. INV-2045" /></label>
              <label>Invoice date<input className="bm-input" type="date" value={invoice.date} onChange={(event) => setInvoice({ ...invoice, date: event.target.value })} /></label>
              <label>Invoice total (Rs.)<input className="bm-input" type="number" min={0} step="0.01" value={invoice.total} onChange={(event) => setInvoice({ ...invoice, total: event.target.value })} /></label>
            </div>
            <div className="po-lines">
              <div className="po-line receive head"><span>Item</span><span>Ordered</span><span>Still due</span><span>Accepted</span><span>Unit price</span></div>
              {order.items.map((item) => (
                <div key={item.id} className="po-line receive">
                  <span><strong>{item.description}</strong>{!item.productId && <em className="td-muted"> · not a stock item, only marked as delivered</em>}</span>
                  <span>{item.quantity}</span>
                  <span>{item.remaining}</span>
                  <input className="bm-input" type="number" min={0} max={item.remaining} step="1" disabled={item.remaining === 0} value={receive[item.id]?.quantity ?? ""} onChange={(event) => setReceive({ ...receive, [item.id]: { ...(receive[item.id] ?? { unitCost: String(item.unitCost) }), quantity: event.target.value } })} aria-label={`${item.description} arrived`} />
                  <input className="bm-input" type="number" min={0} step="0.01" disabled={item.remaining === 0} value={receive[item.id]?.unitCost ?? ""} onChange={(event) => setReceive({ ...receive, [item.id]: { ...(receive[item.id] ?? { quantity: "0" }), unitCost: event.target.value } })} aria-label={`${item.description} unit price`} />
                  {(item.remaining > 0 || (item.freeDue ?? 0) > 0) && (
                    <div className="po-reject">
                      <label>Free issue{item.freeQty ? ` (${item.freeDue} of ${item.freeQty} due)` : ""}<input className="bm-input gd-free" type="number" min={0} value={receive[item.id]?.free ?? ""} placeholder="0" onChange={(event) => setReceive({ ...receive, [item.id]: { ...(receive[item.id] ?? { quantity: "0", unitCost: String(item.unitCost) }), free: event.target.value } })} aria-label={`${item.description} free issue`} /></label>
                      <label>Rejected<input className="bm-input" type="number" min={0} value={receive[item.id]?.rejected ?? ""} placeholder="0" onChange={(event) => setReceive({ ...receive, [item.id]: { ...(receive[item.id] ?? { quantity: "0", unitCost: String(item.unitCost) }), rejected: event.target.value } })} aria-label={`${item.description} rejected`} /></label>
                      {Number(receive[item.id]?.rejected) > 0 && <input className="bm-input" value={receive[item.id]?.reason ?? ""} placeholder="Why rejected? e.g. broken in the crate" onChange={(event) => setReceive({ ...receive, [item.id]: { ...(receive[item.id] ?? { quantity: "0", unitCost: String(item.unitCost) }), reason: event.target.value } })} aria-label={`${item.description} reject reason`} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setPanel(null)} disabled={busy}>Back</button>
              <button type="submit" className="btn-accent" disabled={busy}>{busy ? "Saving…" : "Add to stock"}</button>
            </div>
          </form>
        )}

        {panel === "cancel" && (
          <form className="po-panel" onSubmit={(event) => { event.preventDefault(); void cancel(); }}>
            <h4>Cancel {order.poNumber}?</h4>
            <p className="lx-card-sub">The order stays on record, marked cancelled, with your name and the reason.{order.status === "PARTIAL" ? " Stock already received stays in stock." : ""}</p>
            <label className="lx-member-grid"><span>Reason *</span><input id="po-cancel-reason" className="bm-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. supplier out of stock" autoFocus /></label>
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setPanel(null)} disabled={busy}>Back</button>
              <button type="submit" className="btn-accent po-danger-fill" disabled={busy || reason.trim().length < 3}>Cancel order</button>
            </div>
          </form>
        )}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Item</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Unit price</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Received</th></tr></thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.description}</strong>{item.product && <div className="td-muted">{item.product.quantity} in stock now</div>}</td>
                  <td style={{ textAlign: "right" }}>{item.quantity}{item.freeQty ? <div className="lx-amount-in">+ {item.freeQty} free</div> : null}</td>
                  <td style={{ textAlign: "right" }}>{money(item.unitCost)}</td>
                  <td style={{ textAlign: "right" }}>{money(item.lineTotal)}</td>
                  <td style={{ textAlign: "right" }} className={item.receivedQty >= item.quantity ? "lx-ok-text" : ""}>{item.receivedQty} / {item.quantity}{item.freeQty ? <div className={(item.freeReceived ?? 0) >= item.freeQty ? "lx-amount-in" : "lx-warn-text"}>free {item.freeReceived ?? 0} / {item.freeQty}</div> : null}</td>
                </tr>
              ))}
              <tr className="po-total-row"><td colSpan={3}>Total</td><td style={{ textAlign: "right" }}>{money(order.total)}</td><td /></tr>
            </tbody>
          </table>
        </div>
        {order.notes && <p className="po-note"><strong>Notes:</strong> {order.notes}</p>}

        <div className="po-history">
          <h4>History</h4>
          <ol>
            <li><b>Created</b> by {order.createdBy} · {when(order.createdAt)}</li>
            {[...order.emails].reverse().map((email) => (
              <li key={email.id} className={email.status === "FAILED" ? "failed" : "sent"}>
                <b>{email.status === "SENT" ? "Emailed" : "Email failed"}</b> to {email.toEmail}{email.ccEmail ? ` (copy ${email.ccEmail})` : ""} by {email.sentBy} · {when(email.createdAt)}
                {email.error && <div className="td-muted">{email.error}</div>}
              </li>
            ))}
            {(order.grns ?? []).map((grn) => (
              <li key={grn.id} className="sent"><b>{grn.grnNo}</b> · {grn.acceptedUnits} accepted{grn.rejectedUnits ? `, ${grn.rejectedUnits} rejected` : ""}{grn.supplierInvoiceNo ? ` · invoice ${grn.supplierInvoiceNo}` : ""} · {when(grn.createdAt)}</li>
            ))}
            {order.receivedAt && <li className="sent"><b>Fully received</b> by {order.receivedBy} · {when(order.receivedAt)}</li>}
            {order.status === "PARTIAL" && <li><b>Part received</b> · {order.items.reduce((sum, item) => sum + item.receivedQty, 0)} of {order.items.reduce((sum, item) => sum + item.quantity, 0)} units in</li>}
            {order.cancelledAt && <li className="failed"><b>Cancelled</b> by {order.cancelledBy} · {when(order.cancelledAt)} — {order.cancelReason}</li>}
          </ol>
        </div>
      </div>
    </div>
  );
}
