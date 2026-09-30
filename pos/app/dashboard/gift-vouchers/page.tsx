"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../components/AdminContext";
import TablePagination from "../../components/TablePagination";
import { API_URL } from "../../lib/constants";
import { printGiftVoucherSlips, printGiftVouchers, type GiftVoucherPrint } from "../../lib/giftVoucherPrint";
import { IconGift, IconPlus, IconPrinter, IconSearch } from "../../lib/icons";

type Voucher = {
  id: number; voucherNo: string; code: string; amount: number; kind: "SOLD" | "FREE";
  status: "ACTIVE" | "REDEEMED" | "CANCELLED" | "EXPIRED"; expiresAt: string | null;
  issuedTo: string | null; issuedPhone: string | null; note: string | null;
  issuedAt: string; issuedBy: string; issueBranch: string; paymentLabel: string | null; paymentReference: string | null;
  redeemedAt: string | null; redeemedBy: string | null; redeemedBranch: string | null; redeemedBillNo: string | null;
  cancelledAt: string | null; cancelledBy: string | null; cancelReason: string | null;
};
type Tally = { count: number; value: number };
type ListResult = { vouchers: Voucher[]; total: number; summary: { owed: Tally; freeOut: Tally; redeemed: Tally; expired: Tally; cancelled: Tally } };
type Form = { kind: "SOLD" | "FREE"; amount: string; quantity: string; expiresOn: string; issuedTo: string; issuedPhone: string; note: string; paymentMethod: "CASH" | "CARD" | "BANK_TRANSFER"; paymentReference: string };

const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const STATUS: Record<Voucher["status"], { label: string; badge: string }> = {
  ACTIVE: { label: "Not used", badge: "gv-active" },
  REDEEMED: { label: "Used", badge: "gv-used" },
  EXPIRED: { label: "Expired", badge: "gv-expired" },
  CANCELLED: { label: "Cancelled", badge: "gv-cancelled" },
};
const TABS: Array<{ value: "" | Voucher["status"]; label: string }> = [
  { value: "", label: "All" }, { value: "ACTIVE", label: "Not used" }, { value: "REDEEMED", label: "Used" }, { value: "EXPIRED", label: "Expired" }, { value: "CANCELLED", label: "Cancelled" },
];
const blankForm = (): Form => ({ kind: "SOLD", amount: "", quantity: "1", expiresOn: "", issuedTo: "", issuedPhone: "", note: "", paymentMethod: "CASH", paymentReference: "" });

export default function GiftVouchersPage() {
  const { token, admin, logout } = useAdmin();
  const isAdmin = admin.role === "ADMIN";
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [data, setData] = useState<ListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"" | Voucher["status"]>("");
  const [kind, setKind] = useState<"" | "SOLD" | "FREE">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<GiftVoucherPrint[] | null>(null);
  const [cancelling, setCancelling] = useState<Voucher | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const api = useCallback(async <T,>(path: string, init?: RequestInit) => {
    const response = await fetch(`${API_URL}/api/pos${path}`, { ...init, headers, cache: "no-store" });
    if (response.status === 401) { logout(); throw new Error("Signed out"); }
    const payload = (await response.json().catch(() => ({}))) as { data?: T; message?: string; errors?: Record<string, string[]> };
    if (!response.ok) throw new Error((payload.errors && Object.values(payload.errors).flat()[0]) ?? payload.message ?? "Something went wrong");
    return payload.data as T;
  }, [headers, logout]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (status) params.set("status", status);
    if (kind) params.set("kind", kind);
    if (search.trim()) params.set("search", search.trim());
    try { setData(await api<ListResult>(`/gift-vouchers?${params}`)); setError(null); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load gift vouchers"); }
  }, [api, page, pageSize, status, kind, search]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { setPage(1); }, [status, kind, search, pageSize]);

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 3500); };

  const issue = async () => {
    if (!form) return;
    setBusy(true); setFormError(null);
    try {
      const result = await api<{ vouchers: GiftVoucherPrint[]; total: number }>("/gift-vouchers", {
        method: "POST",
        body: JSON.stringify({
          kind: form.kind,
          amount: Number(form.amount),
          quantity: Number(form.quantity) || 1,
          expiresOn: form.expiresOn || null,
          issuedTo: form.issuedTo || null,
          issuedPhone: form.issuedPhone || null,
          note: form.note || null,
          ...(form.kind === "SOLD" ? { paymentMethod: form.paymentMethod, paymentReference: form.paymentReference || null } : {}),
        }),
      });
      setForm(null);
      setIssued(result.vouchers);
      printGiftVouchers(result.vouchers);
      void load();
    } catch (issueError) { setFormError(issueError instanceof Error ? issueError.message : "Could not issue the voucher"); } finally { setBusy(false); }
  };

  const reprint = async (row: Voucher) => {
    try { printGiftVouchers([await api<GiftVoucherPrint>(`/gift-vouchers/${row.id}/print`)]); }
    catch (printError) { setError(printError instanceof Error ? printError.message : "Could not print"); }
  };

  const cancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await api(`/gift-vouchers/${cancelling.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
      flash(`${cancelling.voucherNo} cancelled`);
      setCancelling(null); setReason("");
      void load();
    } catch (cancelError) { setError(cancelError instanceof Error ? cancelError.message : "Could not cancel"); setCancelling(null); } finally { setBusy(false); }
  };

  const summary = data?.summary;
  const amount = Number(form?.amount) || 0;
  const quantity = Math.max(1, Math.floor(Number(form?.quantity) || 1));

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconGift /></div>
          <div>
            <h2 className="page-title">Gift Vouchers</h2>
            <p className="page-subtitle">Sell or give vouchers with their own code. Each is used once, for its full amount, on a bill at any branch — the rest of the bill is paid any way.</p>
          </div>
        </div>
        {isAdmin && <button type="button" className="btn-accent" onClick={() => { setForm(blankForm()); setFormError(null); }}><IconPlus /> Issue gift vouchers</button>}
      </div>
      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="rt-kpis">
        <div className="rt-kpi"><span>Sold, not used yet</span><strong>{summary ? money(summary.owed.value) : "…"}</strong><em>{summary?.owed.count ?? 0} voucher(s) · money the shop owes</em></div>
        <div className="rt-kpi"><span>Free, not used yet</span><strong>{summary ? money(summary.freeOut.value) : "…"}</strong><em>{summary?.freeOut.count ?? 0} voucher(s) · promotions out</em></div>
        <div className="rt-kpi"><span>Used</span><strong>{summary ? money(summary.redeemed.value) : "…"}</strong><em>{summary?.redeemed.count ?? 0} voucher(s)</em></div>
        <div className={`rt-kpi${summary?.expired.count ? " warn" : ""}`}><span>Expired unused</span><strong>{summary ? money(summary.expired.value) : "…"}</strong><em>{summary?.expired.count ?? 0} voucher(s)</em></div>
      </div>

      <section className="lx-card lx-log-card">
        <div className="po-toolbar gv-toolbar">
          <div className="lx-seg-plain" role="tablist">
            {TABS.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={status === tab.value} className={status === tab.value ? "active" : ""} onClick={() => setStatus(tab.value)}>{tab.label}</button>)}
          </div>
          <select className="bm-select gv-kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} aria-label="Type">
            <option value="">Sold and free</option><option value="SOLD">Sold</option><option value="FREE">Free</option>
          </select>
          <label className="gv-search"><IconSearch /><input className="bm-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Voucher no, code, name, phone or bill" /></label>
        </div>
        <div className="data-table-wrap">
          <table className="data-table gv-table">
            <thead><tr><th>Voucher</th><th style={{ textAlign: "right" }}>Amount</th><th>Type</th><th>Status</th><th>Issued</th><th>Used</th><th>Valid until</th>{isAdmin && <th />}</tr></thead>
            <tbody>
              {data?.vouchers.length === 0 && <tr><td colSpan={isAdmin ? 8 : 7} className="bm-table-empty">No gift vouchers here yet.</td></tr>}
              {data?.vouchers.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.voucherNo}</strong><div className="td-muted gv-code">{row.code}</div>{row.issuedTo && <div className="td-muted">For {row.issuedTo}{row.issuedPhone ? ` · ${row.issuedPhone}` : ""}</div>}</td>
                  <td style={{ textAlign: "right" }}><strong>{money(row.amount)}</strong></td>
                  <td>{row.kind === "SOLD" ? <>Sold<div className="td-muted">{row.paymentLabel}{row.paymentReference ? ` · ${row.paymentReference}` : ""}</div></> : <>Free<div className="td-muted">{row.note}</div></>}</td>
                  <td><span className={`gv-status ${STATUS[row.status].badge}`}>{STATUS[row.status].label}</span>{row.status === "CANCELLED" && <div className="td-muted">{row.cancelReason} · {row.cancelledBy}</div>}</td>
                  <td>{when(row.issuedAt)}<div className="td-muted">{row.issueBranch} · {row.issuedBy}</div></td>
                  <td>{row.redeemedAt ? <>{when(row.redeemedAt)}<div className="td-muted">{row.redeemedBranch}{row.redeemedBranch !== row.issueBranch ? " (other branch)" : ""} · {row.redeemedBillNo} · {row.redeemedBy}</div></> : "—"}</td>
                  <td>{row.expiresAt ? new Date(row.expiresAt).toLocaleDateString("en-GB") : "No expiry"}</td>
                  {isAdmin && (
                    <td className="gv-actions">
                      <button type="button" className="btn-outline" onClick={() => void reprint(row)} title="Print the voucher again (with its full code)"><IconPrinter size={14} /> Print</button>
                      {row.status === "ACTIVE" && <button type="button" className="btn-outline gv-danger" onClick={() => { setCancelling(row); setReason(""); }}>Cancel</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={data?.total ?? 0} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </section>

      {form && (
        <div className="bm-modal-backdrop" onClick={() => setForm(null)}>
          <form className="bm-modal po-modal gv-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void issue(); }}>
            <div className="po-modal-head"><h3 className="bm-modal-title">Issue gift vouchers</h3><button type="button" className="po-close" onClick={() => setForm(null)} aria-label="Close">×</button></div>
            <div className="lx-seg-plain gv-kind-seg" role="radiogroup" aria-label="Type">
              <button type="button" role="radio" aria-checked={form.kind === "SOLD"} className={form.kind === "SOLD" ? "active" : ""} onClick={() => setForm({ ...form, kind: "SOLD" })}>Sold — customer pays</button>
              <button type="button" role="radio" aria-checked={form.kind === "FREE"} className={form.kind === "FREE" ? "active" : ""} onClick={() => setForm({ ...form, kind: "FREE" })}>Free — from the shop</button>
            </div>
            <p className="lx-card-sub">{form.kind === "SOLD"
              ? "The money is taken now and recorded in this branch's Day End (drawer, card machine or bank). It isn't a sale until the voucher is used — until then the shop owes it."
              : "No money comes in. When it's used, its value is recorded as a promotion cost."}</p>
            <div className="lx-member-grid">
              <label>Amount of each voucher (Rs.) *<input className="bm-input" type="number" min={1} step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required autoFocus /></label>
              <label>How many *<input className="bm-input" type="number" min={1} max={50} step={1} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required /></label>
              {form.kind === "SOLD" && (
                <>
                  <label>Paid by *
                    <select className="bm-input" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as Form["paymentMethod"] })}>
                      <option value="CASH">Cash (into the drawer)</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Transfer / QR</option>
                    </select>
                  </label>
                  <label>{form.paymentMethod === "CASH" ? "Reference" : "Approval / reference no"}<input className="bm-input" value={form.paymentReference} disabled={form.paymentMethod === "CASH"} onChange={(event) => setForm({ ...form, paymentReference: event.target.value })} placeholder={form.paymentMethod === "CASH" ? "Not needed for cash" : "From the slip"} /></label>
                </>
              )}
              <label>Phone<input className="bm-input" value={form.issuedPhone} onChange={(event) => setForm({ ...form, issuedPhone: event.target.value })} /></label>
              <label>Valid until<input className="bm-input" type="date" value={form.expiresOn} onChange={(event) => setForm({ ...form, expiresOn: event.target.value })} /><small className="td-muted">Leave empty for no expiry</small></label>
              <label className="wide">{form.kind === "FREE" ? "Why is it free? *" : "Note"}<input className="bm-input" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder={form.kind === "FREE" ? "e.g. opening promotion, apology to a customer" : "Optional"} required={form.kind === "FREE"} /></label>
            </div>
            {amount > 0 && <div className="gv-total">{quantity} × {money(amount)} = <strong>{money(amount * quantity)}</strong>{form.kind === "SOLD" ? ` to take by ${form.paymentMethod === "CASH" ? "cash" : form.paymentMethod === "CARD" ? "card" : "transfer / QR"}` : " given free"}</div>}
            {formError && <div className="bm-alert bm-alert-error">{formError}</div>}
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="btn-accent" disabled={busy}>{busy ? "Issuing…" : `Issue & print ${quantity > 1 ? `${quantity} vouchers` : "voucher"}`}</button>
            </div>
          </form>
        </div>
      )}

      {issued && (
        <div className="bm-modal-backdrop" onClick={() => setIssued(null)}>
          <div className="bm-modal po-modal gv-modal" onClick={(event) => event.stopPropagation()}>
            <div className="po-modal-head"><h3 className="bm-modal-title">{issued.length === 1 ? "Gift voucher issued" : `${issued.length} gift vouchers issued`}</h3><button type="button" className="po-close" onClick={() => setIssued(null)} aria-label="Close">×</button></div>
            <p className="lx-card-sub">Printed in colour at the voucher's real size (190 × 86 mm), one voucher per page — no trimming needed when printed on card of that size. The code is the voucher: anyone who has it can use it once.</p>
            <div className="gv-issued">
              {issued.map((voucher) => (
                <div key={voucher.voucherNo} className="gv-issued-row"><span>{voucher.voucherNo}</span><code>{voucher.code}</code><b>{money(voucher.amount)}</b></div>
              ))}
            </div>
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => printGiftVoucherSlips(issued)} title="For the 80mm till printer">80mm slip</button>
              <button type="button" className="btn-outline" onClick={() => printGiftVouchers(issued)}><IconPrinter size={15} /> Print again</button>
              <button type="button" className="btn-accent" onClick={() => setIssued(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {cancelling && (
        <div className="bm-modal-backdrop" onClick={() => setCancelling(null)}>
          <form className="bm-modal po-modal gv-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void cancel(); }}>
            <div className="po-modal-head"><h3 className="bm-modal-title">Cancel {cancelling.voucherNo}?</h3><button type="button" className="po-close" onClick={() => setCancelling(null)} aria-label="Close">×</button></div>
            <p className="lx-card-sub">{money(cancelling.amount)} · {cancelling.kind === "SOLD" ? "sold" : "free"}. After cancelling, the code can't be used. {cancelling.kind === "SOLD" ? "If you give the customer their money back, record it as an Expense in Day End." : ""}</p>
            <div className="lx-member-grid"><label className="wide">Reason *<input className="bm-input" value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} required autoFocus placeholder="e.g. voucher lost, customer returned it" /></label></div>
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setCancelling(null)}>Keep it</button>
              <button type="submit" className="btn-accent gv-danger-fill" disabled={busy}>{busy ? "Cancelling…" : "Cancel voucher"}</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className="lx-toasts"><div className="lx-toast ok"><div><strong>{toast}</strong></div></div></div>}
    </div>
  );
}
