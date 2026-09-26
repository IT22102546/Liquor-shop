"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../AdminContext";
import TablePagination from "../TablePagination";
import { CashEntryModal } from "./CashEntryModal";
import { API_URL } from "../../lib/constants";
import { buildCashEntryHtml, printCashEntry, type CashEntry } from "../../lib/bookPrint";
import { IconAccounts, IconCheck, IconPlus, IconPrinter, IconRefresh } from "../../lib/icons";

type Category = { value: string; label: string; automatic: boolean };
type ListData = {
  entries: CashEntry[];
  pending?: { amount: number; count: number; byCategory: { category: string; label: string; amount: number; count: number }[] };
  totals: { amount: number; byCategory: { category: string; label: string; amount: number; count: number }[] };
  categories: Category[];
  pagination: { total: number };
};

const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toLocaleDateString("en-CA");
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA"); };

/** Vouchers (OUT: expenses) and Receipts (IN: money received) share this page. */
export function CashBookPage({ direction }: { direction: "IN" | "OUT" }) {
  const { admin, token, logout } = useAdmin();
  const isOut = direction === "OUT";
  const canRecord = admin.role !== "INVENTORY_MANAGER";
  const canVoid = admin.role === "ADMIN" || admin.role === "ACCOUNTANT";
  const [data, setData] = useState<ListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ from: monthStart(), to: today(), category: "", source: "", search: "", bankStatus: "" });
  // Shift takings waiting to be banked: ticked rows go on one deposit slip.
  const [selected, setSelected] = useState<Map<number, CashEntry>>(new Map());
  const [banking, setBanking] = useState<CashEntry[] | null>(null);
  const [bankForm, setBankForm] = useState({ date: today(), reference: "" });
  const [bankBusy, setBankBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<CashEntry | null>(null);
  const [voiding, setVoiding] = useState<CashEntry | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ direction, page: String(page), limit: String(pageSize) });
    Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
    try {
      const [listRes, shiftRes] = await Promise.all([
        fetch(`${API_URL}/api/pos/cash-book?${params}`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/api/pos/shifts/current`, { headers, cache: "no-store" }),
      ]);
      if (listRes.status === 401) { logout(); return; }
      const list = (await listRes.json()) as { data?: ListData; message?: string };
      if (!listRes.ok || !list.data) throw new Error(list.message ?? "Failed to load");
      setData(list.data);
      const shift = (await shiftRes.json().catch(() => ({}))) as { data?: { open: unknown } };
      setShiftOpen(Boolean(shift.data?.open));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load");
    }
  }, [direction, filters, headers, logout, page, pageSize]);

  useEffect(() => { void load(); }, [load]);

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 3000); };

  const submitVoid = async () => {
    if (!voiding || voidReason.trim().length < 3) return;
    const response = await fetch(`${API_URL}/api/pos/cash-book/${voiding.id}/void`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ reason: voidReason.trim() }),
    });
    const payload = (await response.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[]> };
    if (!response.ok) { setError((payload.errors && Object.values(payload.errors)[0]?.[0]) ?? payload.message ?? "Could not void"); setVoiding(null); return; }
    flash(`${voiding.entryNo} voided`);
    setVoiding(null);
    setVoidReason("");
    void load();
  };

  const setFilter = (key: keyof typeof filters, value: string) => { setFilters({ ...filters, [key]: value }); setPage(1); };
  const canBank = !isOut && canVoid;
  const toggle = (entry: CashEntry) => setSelected((current) => {
    const next = new Map(current);
    if (next.has(entry.id)) next.delete(entry.id); else next.set(entry.id, entry);
    return next;
  });
  const selectedList = [...selected.values()];
  const selectedTotal = selectedList.reduce((sum, entry) => sum + entry.amount, 0);
  const showWaiting = () => { setFilters({ ...filters, bankStatus: "PENDING", from: "", to: "", category: "", source: "" }); setPage(1); };

  const submitBank = async () => {
    if (!banking?.length) return;
    setBankBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/pos/cash-book/bank`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: banking.map((entry) => entry.id), date: bankForm.date || undefined, reference: bankForm.reference.trim() || undefined }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[]> };
      if (!response.ok) { setError((payload.errors && Object.values(payload.errors)[0]?.[0]) ?? payload.message ?? "Could not mark as banked"); return; }
      flash(`${banking.length} entr${banking.length === 1 ? "y" : "ies"} marked as banked · ${money(banking.reduce((sum, entry) => sum + entry.amount, 0))}`);
      setBanking(null);
      setSelected(new Map());
      setBankForm({ date: today(), reference: "" });
      void load();
    } finally {
      setBankBusy(false);
    }
  };

  const undoBank = async (entry: CashEntry) => {
    if (!window.confirm(`Undo "banked" on ${entry.entryNo}? It goes back to waiting to be banked.`)) return;
    const response = await fetch(`${API_URL}/api/pos/cash-book/${entry.id}/unbank`, { method: "POST", headers });
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) { setError(payload.message ?? "Could not undo"); return; }
    flash(`${entry.entryNo} is waiting to be banked again`);
    void load();
  };
  const categoryOptions = data?.categories ?? [];

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconAccounts /></div>
          <div>
            <h2 className="page-title">{isOut ? "Expenses (Vouchers)" : "Money In (Receipts)"}</h2>
            <p className="page-subtitle">
              {isOut
                ? "Every rupee paid out — petrol, ice, wages, bills. Each one gets a voucher number and shows who recorded it."
                : "Shift takings (cash, card, QR) are added automatically when a shift closes and wait here until you mark them as banked."}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn-outline" onClick={() => void load()}><IconRefresh size={16} /> Refresh</button>
          {canRecord && <button type="button" className="btn-accent" onClick={() => setAdding(true)}><IconPlus /> {isOut ? "Record expense" : "Record money in"}</button>}
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <section className="lx-card">
        <div className="lx-bill-summary">
          <div><span>{isOut ? "Total paid out" : "Total received"}</span><strong>{data ? money(data.totals.amount) : "—"}</strong></div>
          <div><span>Entries</span><strong>{data?.pagination.total ?? "—"}</strong></div>
          <div><span>Period</span><strong style={{ fontSize: "0.95rem" }}>{filters.from || "…"} → {filters.to || "…"}</strong></div>
        </div>
        {!isOut && data?.pending && (
          <div className={`lx-bank-pending ${data.pending.count ? "" : "clear"}`}>
            <div>
              <strong>{data.pending.count ? `Waiting to be banked · ${money(data.pending.amount)}` : "Everything is banked"}</strong>
              <span>
                {data.pending.count
                  ? data.pending.byCategory.map((row) => `${row.label} ${money(row.amount)} (${row.count})`).join(" · ")
                  : "Shift takings appear here when a shift closes, until you mark them as banked."}
              </span>
            </div>
            {data.pending.count > 0 && filters.bankStatus !== "PENDING" && <button type="button" className="btn-outline" onClick={showWaiting}>Show waiting</button>}
          </div>
        )}
        {data && data.totals.byCategory.length > 0 && (
          <div className="lx-book-totals" style={{ marginTop: "0.9rem" }}>
            {data.totals.byCategory.map((row) => (
              <span key={row.category}>{row.label} ({row.count})<b>{money(row.amount)}</b></span>
            ))}
          </div>
        )}
      </section>

      <section className="lx-card lx-log-card">
        <div className="bm-filters" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", padding: "0.4rem 0.4rem 0.8rem" }}>
          <input className="bm-input" style={{ flex: "1 1 14rem" }} placeholder={isOut ? "Search voucher no, paid to, bill no, note…" : "Search receipt no, from, reference, note…"} value={filters.search} onChange={(event) => setFilter("search", event.target.value)} />
          <select className="bm-input" style={{ width: "auto" }} value={filters.category} onChange={(event) => setFilter("category", event.target.value)}>
            <option value="">All types</option>
            {categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          {!isOut && (
            <select className="bm-input" style={{ width: "auto" }} value={filters.bankStatus} onChange={(event) => setFilter("bankStatus", event.target.value)}>
              <option value="">Banked: any</option>
              <option value="PENDING">Waiting to be banked</option>
              <option value="BANKED">Banked</option>
            </select>
          )}
          <select className="bm-input" style={{ width: "auto" }} value={filters.source} onChange={(event) => setFilter("source", event.target.value)}>
            <option value="">{isOut ? "Paid from: any" : "Paid into: any"}</option>
            <option value="DRAWER">Cash drawer</option>
            <option value="BANK">Bank</option>
            {!isOut && <option value="SAFE">Safe (not banked)</option>}
            {!isOut && <option value="CARD">Card company (not banked)</option>}
            {isOut && <option value="OWNER">Owner</option>}
          </select>
          <input className="bm-input" style={{ width: "auto" }} type="date" value={filters.from} onChange={(event) => setFilter("from", event.target.value)} />
          <input className="bm-input" style={{ width: "auto" }} type="date" value={filters.to} onChange={(event) => setFilter("to", event.target.value)} />
        </div>

        {selectedList.length > 0 && (
          <div className="lx-bank-bar">
            <span><b>{selectedList.length}</b> selected · <b>{money(selectedTotal)}</b></span>
            <button type="button" className="btn-outline btn-sm" onClick={() => setSelected(new Map())}>Clear</button>
            <button type="button" className="btn-accent" onClick={() => setBanking(selectedList)}>Mark as banked</button>
          </div>
        )}
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {canBank && <th style={{ width: 28 }} />}
                <th>Date</th><th>No</th><th>{isOut ? "For" : "Type"}</th><th>{isOut ? "Paid to" : "Received from"}</th><th>{isOut ? "Paid from" : "Paid into"}</th><th>Shift</th><th>Recorded by</th>
                <th style={{ textAlign: "right" }}>Amount</th><th />
              </tr>
            </thead>
            <tbody>
              {!data && <tr><td colSpan={canBank ? 10 : 9} className="bm-table-empty">Loading…</td></tr>}
              {data?.entries.length === 0 && <tr><td colSpan={canBank ? 10 : 9} className="bm-table-empty">{isOut ? "No expenses recorded for this period." : "No money in recorded for this period."}</td></tr>}
              {data?.entries.map((entry) => (
                <tr key={entry.id} className={entry.voided ? "lx-void-row" : selected.has(entry.id) ? "lx-row-selected" : ""}>
                  {canBank && (
                    <td>{entry.bankStatus === "PENDING" && !entry.voided && (
                      <input type="checkbox" className="lx-row-check" checked={selected.has(entry.id)} onChange={() => toggle(entry)} aria-label={`Select ${entry.entryNo}`} />
                    )}</td>
                  )}
                  <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{new Date(entry.entryDate).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{entry.entryNo}</td>
                  <td style={{ minWidth: "13rem" }}>
                    <strong>{entry.categoryLabel}</strong>{entry.automatic && <span className="lx-auto-tag">Auto</span>}
                    {/* Automatic entries' notes repeat the shift; they stay on the printed receipt. */}
                    {entry.note && !entry.automatic && <div className="td-muted">{entry.note}</div>}
                    {entry.reference && !entry.automatic && <div className="td-muted">Ref: {entry.reference}</div>}
                    {entry.voided && <div className="td-muted">Voided{entry.voidedBy ? ` by ${entry.voidedBy.name}` : ""}: {entry.voidReason}</div>}
                  </td>
                  <td>{entry.party ?? "—"}</td>
                  <td>
                    {entry.bankStatus === "PENDING" ? (
                      <>
                        <span className="lx-bank-tag pending">{entry.source === "CARD" ? "With card company" : entry.source === "SAFE" ? "In safe" : "Check in bank"} · not banked</span>
                        {canBank && !entry.voided && <div><button type="button" className="lx-link-btn" onClick={() => setBanking([entry])}>Mark banked →</button></div>}
                      </>
                    ) : entry.bankStatus === "BANKED" ? (
                      <>
                        <span className="lx-bank-tag banked">Banked</span>
                        <div className="td-muted">{entry.bankedAt ? new Date(entry.bankedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}{entry.bankReference ? ` · slip ${entry.bankReference}` : ""}{entry.bankedBy ? ` · ${entry.bankedBy.name}` : ""}</div>
                        {admin.role === "ADMIN" && <button type="button" className="lx-link-btn muted" onClick={() => void undoBank(entry)} title="Marked by mistake? Put it back to waiting">Undo</button>}
                      </>
                    ) : entry.sourceLabel}
                  </td>
                  <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{entry.shift?.shiftNo ?? "—"}</td>
                  <td>{entry.createdBy?.name ?? "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }} className={isOut ? "lx-amount-out" : "lx-amount-in"}>{money(entry.amount)}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <button type="button" className="btn-outline btn-sm" onClick={() => setViewing(entry)} title="View & print"><IconPrinter size={14} /></button>
                    {canVoid && !entry.voided && !entry.automatic && entry.shift?.status !== "CLOSED" && (
                      <button type="button" className="btn-outline btn-sm" style={{ marginLeft: 6 }} onClick={() => { setVoiding(entry); setVoidReason(""); }}>Void</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={data?.pagination.total ?? 0} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </section>

      {adding && (
        <CashEntryModal
          token={token}
          direction={direction}
          drawerOnly={admin.role === "CASHIER"}
          shiftOpen={shiftOpen}
          onClose={() => setAdding(false)}
          onSaved={(entry) => { setAdding(false); setViewing(entry); flash(`${entry.entryNo} saved`); void load(); }}
        />
      )}

      {viewing && (
        <div className="bm-modal-backdrop" onClick={() => setViewing(null)}>
          <div className="pos-receipt-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={viewing.entryNo}>
            <div className="pos-receipt-head">
              <span className="pos-receipt-check neutral"><IconPrinter size={20} /></span>
              <div><strong>{isOut ? "Voucher" : "Receipt"} {viewing.entryNo}</strong><span>{viewing.categoryLabel} · {money(viewing.amount)}</span></div>
            </div>
            <iframe className="pos-receipt-paper" title="Preview" srcDoc={buildCashEntryHtml(viewing)} />
            <div className="pos-receipt-actions">
              <button type="button" className="btn-outline" onClick={() => printCashEntry(viewing)}><IconPrinter size={16} /> Print</button>
              <button type="button" className="btn-accent" autoFocus onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {banking && (
        <div className="bm-modal-backdrop" onClick={() => !bankBusy && setBanking(null)}>
          <form className="bm-modal lx-member-modal lx-entry-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void submitBank(); }}>
            <h3 className="bm-modal-title">Mark as banked</h3>
            <p className="lx-card-sub">Do this after the money is actually in the bank: cash deposited from the safe, or card and QR money showing in the bank account.</p>
            <div className="lx-bank-list">
              {banking.map((entry) => (
                <div key={entry.id}><span><b>{entry.entryNo}</b> · {entry.categoryLabel}{entry.shift ? ` · ${entry.shift.shiftNo}` : ""}</span><strong>{money(entry.amount)}</strong></div>
              ))}
              <div className="total"><span>Total to bank</span><strong>{money(banking.reduce((sum, entry) => sum + entry.amount, 0))}</strong></div>
            </div>
            <div className="lx-member-grid">
              <label>Banked on *<input className="bm-input" type="date" value={bankForm.date} max={today()} onChange={(event) => setBankForm({ ...bankForm, date: event.target.value })} required /></label>
              <label>Deposit slip / bank reference<input className="bm-input" value={bankForm.reference} onChange={(event) => setBankForm({ ...bankForm, reference: event.target.value })} placeholder="e.g. BOC slip 004218" autoFocus /></label>
            </div>
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setBanking(null)} disabled={bankBusy}>Cancel</button>
              <button type="submit" className="btn-accent" disabled={bankBusy || !bankForm.date}>{bankBusy ? "Saving…" : "Confirm banked"}</button>
            </div>
          </form>
        </div>
      )}

      {voiding && (
        <div className="bm-modal-backdrop" onClick={() => setVoiding(null)}>
          <form className="bm-modal lx-member-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void submitVoid(); }}>
            <h3 className="bm-modal-title">Void {voiding.entryNo}?</h3>
            <p className="lx-card-sub">{voiding.categoryLabel} · {money(voiding.amount)}. It stays in the book crossed out, with your name and the reason.</p>
            <label className="lx-member-grid"><span>Reason *</span><input className="bm-input" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="e.g. entered twice" autoFocus /></label>
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setVoiding(null)}>Cancel</button>
              <button type="submit" className="btn-accent" disabled={voidReason.trim().length < 3}>Void entry</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className="lx-toasts"><div className="lx-toast ok"><span className="lx-toast-icon"><IconCheck size={16} /></span><div><strong>{toast}</strong></div></div></div>}
    </div>
  );
}
