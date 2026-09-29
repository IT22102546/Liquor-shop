"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdmin } from "../../components/AdminContext";
import TablePagination from "../../components/TablePagination";
import { API_URL } from "../../lib/constants";
import { useBranch } from "../../lib/useBranch";
import { buildGtnHtml, printGtn, type GtnRecord } from "../../lib/goodsPrint";
import { IconCheck, IconClose, IconPlus, IconPrinter, IconTransfer } from "../../lib/icons";

type Row = {
  id: number; gtnNo: string; status: GtnRecord["status"]; statusLabel: string; fromBranchId: number; toBranchId: number; fromBranch: string; toBranch: string;
  sentAt: string; receivedAt: string | null; sentBy: string; receivedBy: string | null; lines: number; sent: number; received: number; damaged: number; missing: number;
};
type Product = { id: number; name: string; compatibleWith: string | null; partNumber: string | null; quantity: number; brand: { name: string } };
type BranchOption = { id: number; code: string; name: string; isActive: boolean };
type Api = <T>(path: string, init?: RequestInit) => Promise<T>;

const when = (value: string | null) => (value ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export default function TransfersPage() {
  const { token, admin, logout } = useAdmin();
  const { state: branchState, branch } = useBranch(token);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [direction, setDirection] = useState<"" | "in" | "out">("");
  const [status, setStatus] = useState<"" | "SENT" | "RECEIVED" | "CANCELLED">("");
  const [allBranches, setAllBranches] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState<GtnRecord | null>(null);
  const [receiving, setReceiving] = useState<GtnRecord | null>(null);
  const [cancelling, setCancelling] = useState<GtnRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const canHandle = admin?.role !== "ACCOUNTANT";

  const api: Api = useCallback(async <T,>(path: string, init?: RequestInit) => {
    const response = await fetch(`${API_URL}/api/pos${path}`, { ...init, headers, cache: "no-store" });
    if (response.status === 401) { logout(); throw new Error("Signed out"); }
    const payload = (await response.json().catch(() => ({}))) as { data?: T; message?: string; errors?: Record<string, string[]> };
    if (!response.ok) throw new Error((payload.errors && Object.values(payload.errors).flat()[0]) ?? payload.message ?? "Something went wrong");
    return payload.data as T;
  }, [headers, logout]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (direction && !allBranches) params.set("direction", direction);
    if (status) params.set("status", status);
    if (allBranches) params.set("branch", "all");
    try {
      const data = await api<{ rows: Row[]; total: number; waitingToReceive: number }>(`/gtns?${params}`);
      setRows(data.rows); setTotal(data.total); setError(null);
      if (!allBranches) setWaiting(data.waitingToReceive);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load transfers"); }
  }, [allBranches, api, direction, page, pageSize, status]);
  useEffect(() => { void load(); }, [load]);

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 3500); };
  const open = async (id: number, then?: "receive" | "cancel") => {
    try {
      const gtn = await api<GtnRecord>(`/gtns/${id}`);
      if (then === "receive") setReceiving(gtn); else if (then === "cancel") setCancelling(gtn); else setViewing(gtn);
    } catch (openError) { setError(openError instanceof Error ? openError.message : "Could not open the transfer"); }
  };

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconTransfer /></div>
          <div>
            <h2 className="page-title">Branch Transfers (GTN)</h2>
            <p className="page-subtitle">Share stock between branches. Bottles leave {branch?.name ?? "this branch"} when you send them and are added at the other branch when they check them in.</p>
          </div>
        </div>
        {canHandle && <button type="button" className="btn-accent" onClick={() => setSending(true)}><IconPlus /> Send stock to a branch</button>}
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}
      {waiting > 0 && !allBranches && (
        <div className="gd-warn" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <span>{waiting} transfer{waiting === 1 ? " is" : "s are"} on the way to {branch?.name}. Check the bottles in when they arrive.</span>
          <button type="button" className="btn-outline" onClick={() => { setDirection("in"); setStatus("SENT"); setPage(1); }}>Show</button>
        </div>
      )}

      <section className="lx-card lx-log-card">
        <div className="po-toolbar">
          <div className="lx-seg-plain" role="tablist">
            {([["", "All"], ["in", `Coming in`], ["out", "Sent out"]] as const).map(([value, label]) => (
              <button key={value || "all"} type="button" className={direction === value ? "active" : ""} disabled={allBranches} onClick={() => { setDirection(value); setPage(1); }}>{label}</button>
            ))}
          </div>
          <div className="po-filters">
            <select className="bm-input" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }} aria-label="Status">
              <option value="">Any status</option><option value="SENT">In transit</option><option value="RECEIVED">Received</option><option value="CANCELLED">Cancelled</option>
            </select>
            {branchState?.canSwitch && <label className="lx-check"><input type="checkbox" checked={allBranches} onChange={(event) => { setAllBranches(event.target.checked); setPage(1); }} /> All branches</label>}
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>GTN</th><th>Sent</th><th>From → To</th><th style={{ textAlign: "right" }}>Bottles</th><th>Status</th><th>Checked in</th><th>Sent by</th><th /></tr></thead>
            <tbody>
              {rows === null && <tr><td colSpan={8} className="bm-table-empty">Loading…</td></tr>}
              {rows?.length === 0 && <tr><td colSpan={8} className="bm-table-empty">No transfers yet.</td></tr>}
              {rows?.map((row) => {
                const incoming = row.toBranchId === branch?.id;
                return (
                  <tr key={row.id} className="po-row" onClick={() => void open(row.id)}>
                    <td><strong>{row.gtnNo}</strong></td>
                    <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{when(row.sentAt)}</td>
                    <td><span className="gd-arrow">{row.fromBranch} <i>→</i> {row.toBranch}</span></td>
                    <td style={{ textAlign: "right" }}>{row.sent}<div className="td-muted">{row.lines} item(s)</div></td>
                    <td><span className={`gd-status ${row.status}`}>{row.statusLabel}</span></td>
                    <td className="td-muted">{row.status === "RECEIVED" ? <>{row.received} good{row.damaged ? ` · ${row.damaged} damaged` : ""}{row.missing ? <span className="lx-amount-out"> · {row.missing} missing</span> : ""}<div>{row.receivedBy} · {when(row.receivedAt)}</div></> : "—"}</td>
                    <td>{row.sentBy}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(event) => event.stopPropagation()}>
                      {canHandle && row.status === "SENT" && incoming && !allBranches && <button type="button" className="btn-accent lx-row-btn" onClick={() => void open(row.id, "receive")}>Receive</button>}
                      {canHandle && row.status === "SENT" && (row.fromBranchId === branch?.id || admin?.role === "ADMIN") && !incoming && <button type="button" className="btn-outline lx-row-btn" onClick={() => void open(row.id, "cancel")}>Cancel</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </section>

      {sending && branch && <SendModal api={api} fromName={branch.name} fromId={branch.id} onClose={() => setSending(false)} onSent={(gtn) => { setSending(false); setViewing(gtn); flash(`${gtn.gtnNo} sent to ${gtn.toBranch.name} — ${gtn.totals.sent} bottle(s) now in transit`); void load(); }} />}
      {receiving && <ReceiveModal api={api} gtn={receiving} onClose={() => setReceiving(null)} onDone={(gtn) => { setReceiving(null); setViewing(gtn); flash(`${gtn.gtnNo} received — ${gtn.totals.received} bottle(s) added to stock`); void load(); }} />}
      {cancelling && <CancelModal api={api} gtn={cancelling} onClose={() => setCancelling(null)} onDone={(gtn) => { setCancelling(null); flash(`${gtn.gtnNo} cancelled — stock is back at ${gtn.fromBranch.name}`); void load(); }} />}
      {viewing && (
        <div className="bm-modal-backdrop" onClick={() => setViewing(null)}>
          <div className="lx-report-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={viewing.gtnNo}>
            <div className="lx-report-head">
              <div><strong>{viewing.gtnNo} · {viewing.fromBranch.name} → {viewing.toBranch.name}</strong><span>{viewing.statusLabel} · {viewing.totals.sent} bottle(s)</span></div>
              <div className="lx-report-actions">
                <button type="button" className="btn-accent" onClick={() => printGtn(viewing)}><IconPrinter size={16} /> Print A4 / Save PDF</button>
                <button type="button" className="btn-outline" onClick={() => setViewing(null)}>Close</button>
              </div>
            </div>
            <iframe className="lx-report-frame" title="GTN preview" srcDoc={buildGtnHtml(viewing)} />
          </div>
        </div>
      )}
      {toast && <div className="lx-toasts"><div className="lx-toast ok"><span className="lx-toast-icon"><IconCheck size={16} /></span><div><strong>{toast}</strong></div></div></div>}
    </div>
  );
}

function Shell({ title, sub, onClose, onSubmit, busy, error, submitLabel, children }: { title: string; sub: string; onClose: () => void; onSubmit: () => void; busy: boolean; error: string | null; submitLabel: string; children: React.ReactNode }) {
  return (
    <div className="bm-modal-backdrop">
      <form className="bm-modal po-modal" style={{ width: "min(900px, 96vw)" }} onSubmit={(event: FormEvent) => { event.preventDefault(); onSubmit(); }} role="dialog" aria-label={title}>
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

function useRun(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return { busy, error, run: async () => { setBusy(true); setError(null); try { await action(); } catch (runError) { setError(runError instanceof Error ? runError.message : "Could not save"); } finally { setBusy(false); } } };
}

function SendModal({ api, fromName, fromId, onClose, onSent }: { api: Api; fromName: string; fromId: number; onClose: () => void; onSent: (gtn: GtnRecord) => void }) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [toBranchId, setToBranchId] = useState("");
  const [carriedBy, setCarriedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Array<{ key: number; productId: string; quantity: string }>>([{ key: 1, productId: "", quantity: "" }]);
  useEffect(() => {
    void api<BranchOption[]>("/branches").then((list) => setBranches(list.filter((item) => item.id !== fromId))).catch(() => setBranches([]));
    void api<{ products: Product[] }>("/inventory-management/products?limit=5000").then((result) => setProducts(result.products)).catch(() => setProducts([]));
  }, [api, fromId]);
  const byId = new Map(products.map((product) => [String(product.id), product]));
  const send = useRun(async () => {
    if (!toBranchId) throw new Error("Choose the branch to send to");
    const picked = lines.filter((line) => line.productId && Number(line.quantity) > 0);
    if (picked.length === 0) throw new Error("Add the bottles to send");
    onSent(await api<GtnRecord>("/gtns", { method: "POST", body: JSON.stringify({ toBranchId: Number(toBranchId), carriedBy: carriedBy || null, notes: notes || null, lines: picked.map((line) => ({ productId: Number(line.productId), quantity: Number(line.quantity) })) }) }));
  });
  const units = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  return (
    <Shell title={`Send stock from ${fromName}`} sub="The bottles come off this branch's shelf now and are in transit until the other branch checks them in." onClose={onClose} onSubmit={() => void send.run()} busy={send.busy} error={send.error} submitLabel={`Send ${units} bottle(s)`}>
      {branches.length === 0 ? <div className="gd-warn">There is no other branch yet. An administrator can add one on the Branches page.</div> : (
        <div className="lx-member-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <label>Send to *
            <select className="bm-input" value={toBranchId} onChange={(event) => setToBranchId(event.target.value)} autoFocus>
              <option value="">Choose a branch…</option>
              {branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Carried by<input className="bm-input" value={carriedBy} onChange={(event) => setCarriedBy(event.target.value)} placeholder="Driver / vehicle no." /></label>
          <label>Note<input className="bm-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. weekend stock" /></label>
        </div>
      )}
      <div className="gd-lines">
        <div className="gd-line gtn head"><span>Product</span><span className="num">Here now</span><span className="num">Send</span><span /></div>
        {lines.map((line) => {
          const product = byId.get(line.productId);
          const over = product ? Number(line.quantity) > product.quantity : false;
          return (
            <div key={line.key} className="gd-line gtn">
              <select className="bm-input" value={line.productId} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, productId: event.target.value } : item))} aria-label="Product">
                <option value="">Choose a product…</option>
                {products.filter((item) => item.quantity > 0 || item.id === Number(line.productId)).map((item) => <option key={item.id} value={item.id}>{[item.name, item.compatibleWith].filter(Boolean).join(" · ")} — {item.brand.name}</option>)}
              </select>
              <span className="num">{product ? product.quantity : "—"}</span>
              <input className={`bm-input${over ? " lx-input-error" : ""}`} type="number" min={1} max={product?.quantity} value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, quantity: event.target.value } : item))} aria-label="Quantity to send" />
              <button type="button" className="po-line-remove" onClick={() => setLines((current) => current.length > 1 ? current.filter((item) => item.key !== line.key) : current)} aria-label="Remove"><IconClose /></button>
            </div>
          );
        })}
        <div><button type="button" className="btn-outline" onClick={() => setLines((current) => [...current, { key: Date.now(), productId: "", quantity: "" }])}><IconPlus /> Add product</button></div>
      </div>
    </Shell>
  );
}

function ReceiveModal({ api, gtn, onClose, onDone }: { api: Api; gtn: GtnRecord; onClose: () => void; onDone: (gtn: GtnRecord) => void }) {
  const [counts, setCounts] = useState<Record<number, { received: string; damaged: string }>>(Object.fromEntries(gtn.items.map((item) => [item.id, { received: String(item.sentQty), damaged: "" }])));
  const [note, setNote] = useState("");
  const rows = gtn.items.map((item) => {
    const received = Math.max(0, Math.floor(Number(counts[item.id]?.received) || 0));
    const damaged = Math.max(0, Math.floor(Number(counts[item.id]?.damaged) || 0));
    return { item, received, damaged, missing: item.sentQty - received - damaged };
  });
  const missing = rows.reduce((sum, row) => sum + Math.max(0, row.missing), 0);
  const receive = useRun(async () => {
    if (rows.some((row) => row.missing < 0)) throw new Error("More bottles counted than were sent — check the numbers");
    onDone(await api<GtnRecord>(`/gtns/${gtn.id}/receive`, { method: "POST", body: JSON.stringify({ note: note || null, lines: rows.map((row) => ({ itemId: row.item.id, received: row.received, damaged: row.damaged })) }) }));
  });
  return (
    <Shell title={`Receive ${gtn.gtnNo} from ${gtn.fromBranch.name}`} sub={`Sent ${when(gtn.sentAt)} by ${gtn.sentBy}${gtn.carriedBy ? ` · carried by ${gtn.carriedBy}` : ""}. Count what arrived: good bottles go on the shelf, damaged ones are kept aside.`} onClose={onClose} onSubmit={() => void receive.run()} busy={receive.busy} error={receive.error} submitLabel="Receive into stock">
      <div className="gd-lines">
        <div className="gd-line rcv head"><span>Product</span><span className="num">Sent</span><span className="num">Arrived good</span><span className="num">Damaged</span><span className="num">Missing</span></div>
        {rows.map((row) => (
          <div key={row.item.id} className="gd-line rcv">
            <strong>{row.item.productName}</strong>
            <span className="num">{row.item.sentQty}</span>
            <input className="bm-input" type="number" min={0} max={row.item.sentQty} value={counts[row.item.id]?.received ?? ""} onChange={(event) => setCounts({ ...counts, [row.item.id]: { ...counts[row.item.id], received: event.target.value } })} aria-label={`${row.item.productName} arrived good`} />
            <input className="bm-input" type="number" min={0} max={row.item.sentQty} value={counts[row.item.id]?.damaged ?? ""} placeholder="0" onChange={(event) => setCounts({ ...counts, [row.item.id]: { ...counts[row.item.id], damaged: event.target.value } })} aria-label={`${row.item.productName} damaged`} />
            <span className={`num${row.missing ? " missing" : ""}`}>{row.missing}</span>
          </div>
        ))}
      </div>
      {missing > 0 ? <div className="gd-warn">{missing} bottle(s) missing. Write what happened below — it goes on the transfer note and the Day End book.</div> : <div className="gd-ok">Everything sent is accounted for.</div>}
      <label className="po-notes">Note{missing > 0 ? " *" : ""}<input className="bm-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder={missing ? "e.g. 1 bottle not in the crate" : "Optional"} /></label>
      {gtn.notes && <p className="po-note">Note from {gtn.fromBranch.name}: {gtn.notes}</p>}
    </Shell>
  );
}

function CancelModal({ api, gtn, onClose, onDone }: { api: Api; gtn: GtnRecord; onClose: () => void; onDone: (gtn: GtnRecord) => void }) {
  const [reason, setReason] = useState("");
  const cancel = useRun(async () => { onDone(await api<GtnRecord>(`/gtns/${gtn.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) })); });
  return (
    <Shell title={`Cancel ${gtn.gtnNo}?`} sub={`${gtn.totals.sent} bottle(s) go back on ${gtn.fromBranch.name}'s shelf. Only for a transfer that did not leave the branch.`} onClose={onClose} onSubmit={() => void cancel.run()} busy={cancel.busy} error={cancel.error} submitLabel="Cancel transfer">
      <label className="po-notes">Why is it cancelled? *<input className="bm-input" value={reason} onChange={(event) => setReason(event.target.value)} autoFocus placeholder="e.g. sent to the wrong branch" /></label>
    </Shell>
  );
}
