"use client";

import { loadOfflineBills, onOfflineBillsChange } from "../../lib/offlineSales";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../components/AdminContext";
import { CashEntryModal } from "../../components/book/CashEntryModal";
import { API_URL } from "../../lib/constants";
import { discountText, printZReport, type ShiftReport } from "../../lib/bookPrint";
import { buildDayEndReportHtml, printDayEndReport } from "../../lib/dayEndReport";
import { IconCash, IconCheck, IconClock, IconInvoice, IconPlus, IconPrinter, IconRefresh } from "../../lib/icons";

type CurrentShift = {
  open: { id: number; shiftNo: string; openedAt: string; openingFloat: number; counted: boolean } | null;
  suggestedFloat: number;
  lastClosed: { shiftNo: string; closedAt: string } | null;
  denominations: number[];
};
type ShiftRow = { id: number; shiftNo: string; status: string; openedAt: string; openedBy: string; closedAt: string | null; closedBy: string | null; openingFloat: number; netSales: number | null; bills: number | null; cashDifference: number | null; cashBanked: number | null };
type ShiftTab = "bills" | "payments" | "wallets" | "returns" | "goods" | "staff" | "items" | "offers" | "cash" | "stock" | "stockin" | "journal" | "drawer" | "vouchers";
type CountResult = { countedCash: number; expectedCash: number; difference: number; cardSales: number; recounts: number };

const money = (value: number | null | undefined) => (value == null ? "—" : `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const diffText = (value: number) => (Math.abs(value) < 0.005 ? "Balanced" : `${value > 0 ? "Over" : "Short"} ${money(Math.abs(value))}`);

export default function DayEndPage() {
  const { admin, token, logout } = useAdmin();
  const canOperate = admin.role === "ADMIN" || admin.role === "CASHIER";
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [current, setCurrent] = useState<CurrentShift | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [blind, setBlind] = useState(false);
  const [history, setHistory] = useState<ShiftRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [floatInput, setFloatInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [entryModal, setEntryModal] = useState<"IN" | "OUT" | null>(null);
  const [tab, setTab] = useState<ShiftTab>("bills");
  // Bills sold offline on this computer must upload before the shift closes, or they'd miss its Day End.
  const [offlineWaiting, setOfflineWaiting] = useState(0);
  useEffect(() => {
    const refresh = () => setOfflineWaiting(loadOfflineBills().length);
    refresh();
    return onOfflineBillsChange(refresh);
  }, []);
  const [closing, setClosing] = useState(false);
  const [viewing, setViewing] = useState<ShiftReport | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const api = useCallback(async <T,>(path: string, init?: RequestInit) => {
    const response = await fetch(`${API_URL}/api/pos${path}`, { ...init, headers: { ...auth, "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
    if (response.status === 401) { logout(); throw new Error("Signed out"); }
    const payload = (await response.json().catch(() => ({}))) as { data?: T; message?: string; errors?: Record<string, string[]> };
    if (!response.ok) throw new Error((payload.errors && Object.values(payload.errors)[0]?.[0]) ?? payload.message ?? "Something went wrong");
    return payload.data as T;
  }, [auth, logout]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cur, list] = await Promise.all([api<CurrentShift>("/shifts/current"), api<{ shifts: ShiftRow[] }>("/shifts?limit=30")]);
      setCurrent(cur);
      setHistory(list.shifts.filter((shift) => shift.status === "CLOSED"));
      setFloatInput((value) => value || String(cur.suggestedFloat || ""));
      if (cur.open) {
        const live = await api<{ report: ShiftReport; blind?: boolean }>(`/shifts/${cur.open.id}/report`);
        setReport(live.report);
        setBlind(Boolean(live.blind));
      } else {
        setReport(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load");
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 3000); };

  const startShift = async () => {
    const amount = Number(floatInput || "0");
    if (!(amount >= 0)) { setError("Enter the opening float"); return; }
    setBusy(true);
    try {
      const shift = await api<{ shiftNo: string }>("/shifts/open", { method: "POST", body: JSON.stringify({ openingFloat: amount }) });
      flash(`Shift ${shift.shiftNo} started`);
      await load();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start the shift");
    } finally {
      setBusy(false);
    }
  };

  const openReport = async (id: number) => {
    try {
      const data = await api<{ report: ShiftReport }>(`/shifts/${id}/report`);
      setViewing(data.report);
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "Could not open the report");
    }
  };

  const open = current?.open;
  const entries = report?.cash.entries.filter((entry) => !entry.automatic) ?? [];

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconClock /></div>
          <div>
            <h2 className="page-title">Day End</h2>
            <p className="page-subtitle">Open a shift with a float, record every expense, then count the drawer and close with a Z report.</p>
          </div>
        </div>
        <button type="button" className="btn-outline" onClick={() => void load()}><IconRefresh size={16} /> Refresh</button>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      {current && !open && (
        <section className="lx-card lx-shift-start">
          <div>
            <span className="lx-eyebrow">No shift open</span>
            <h3 className="lx-shift-title">Start the till</h3>
            <p className="lx-card-sub">Count the cash you're putting in the drawer to start with (the float). {current.lastClosed ? `Last shift ${current.lastClosed.shiftNo} left ${money(current.suggestedFloat)} as float.` : ""}</p>
          </div>
          {canOperate ? (
            <form className="lx-shift-start-form" onSubmit={(event) => { event.preventDefault(); void startShift(); }}>
              <label>Opening float (Rs.)<input className="bm-input" type="number" min={0} step="0.01" value={floatInput} onChange={(event) => setFloatInput(event.target.value)} autoFocus /></label>
              <button type="submit" className="btn-accent" disabled={busy}>{busy ? "Starting…" : "Start shift"}</button>
            </form>
          ) : <span className="lx-readonly-pill">View only</span>}
        </section>
      )}

      {open && report && (
        <>
          <section className="lx-card lx-shift-live">
            <div className="lx-shift-live-head">
              <div>
                <span className="lx-eyebrow"><i className="lx-live-dot" /> Shift open</span>
                <h3 className="lx-shift-title">{open.shiftNo}</h3>
                <p className="lx-card-sub">Started {time(open.openedAt)} by {report.shift.openedBy} · float {money(open.openingFloat)}{open.counted ? " · drawer counted" : ""}</p>
              </div>
              {canOperate && (
                <div className="lx-shift-actions">
                  <button type="button" className="btn-outline" onClick={() => setEntryModal("OUT")}><IconPlus /> Record expense</button>
                  <button type="button" className="btn-outline" onClick={() => setEntryModal("IN")}><IconCash size={16} /> Cash in</button>
                  <button type="button" className="btn-outline" onClick={() => setViewing(report)} disabled={blind} title={blind ? "Available after the drawer is counted" : "See and print the figures so far"}><IconPrinter size={16} /> Report so far</button>
                  <button type="button" className="btn-accent" onClick={() => setClosing(true)} disabled={offlineWaiting > 0} title={offlineWaiting > 0 ? `${offlineWaiting} bill(s) sold offline on this computer are still waiting to upload` : undefined}><IconCheck size={16} /> Close shift</button>
                </div>
              )}
            </div>
            <div className="lx-shift-kpis">
              <div><span>Bills</span><strong>{report.sales.bills}</strong><em>{report.sales.units} units sold</em></div>
              <div><span>Net sales</span><strong>{blind ? "Hidden" : money(report.sales.netSales)}</strong><em>{blind ? "shown after the drawer count" : `cash ${money(report.sales.cashSales)} · card ${money(report.sales.cardSales)}${report.sales.transferSales ? ` · QR ${money(report.sales.transferSales)}` : ""}`}</em></div>
              <div><span>Paid out</span><strong>{money(entries.filter((e) => e.direction === "OUT" && !e.voided).reduce((sum, e) => sum + e.amount, 0))}</strong><em>{entries.filter((e) => e.direction === "OUT" && !e.voided).length} expense(s) this shift</em></div>
              <div><span>Expected in drawer</span><strong>{blind ? "Hidden" : money(report.cash.expectedCash)}</strong><em>{blind ? "blind count — count first" : `float + cash sales${report.cash.walletKept ? " + wallet change" : ""}${report.cash.voucherSalesCash ? " + vouchers sold" : ""} + in − out${report.cash.refundsCash ? " − refunds" : ""}`}</em></div>
            </div>
          </section>

          <section className="lx-card lx-log-card">
            <div className="lx-seg-plain" role="tablist" style={{ margin: "0.4rem 0.4rem 0.6rem" }}>
              {([["bills", `Sales (${report.sales.bills})`], ["payments", `Payments${report.payments?.splitBills.length ? ` · ${report.payments.splitBills.length} split` : ""}`], ["wallets", `Customer wallets (${report.wallet?.rows.length ?? 0})`], ["returns", `Returns & damages (${report.returns?.rows.length ?? 0})`], ["goods", `Goods in & out (${(report.goods?.grns.length ?? 0) + (report.goods?.sent.length ?? 0) + (report.goods?.received.length ?? 0)})`], ["staff", "By staff"], ["items", "Items sold"], ["offers", `Discounts & loyalty (${report.sales.loyalty?.rows.length ?? 0})`], ["cash", `Expenses & cash in (${entries.length})`], ["vouchers", `Gift vouchers (${(report.giftVouchers?.issued.length ?? 0) + (report.giftVouchers?.used.length ?? 0)})`], ["drawer", `Drawer opened${report.drawer ? ` (${report.drawer.noSaleCount} no sale)` : ""}`], ["stock", "Stock book"], ["stockin", `Stock in & changes (${report.stockLog?.length ?? 0})`], ["journal", `Shift journal (${report.journal?.length ?? 0})`]] as const).map(([key, label]) => (
                <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>
              ))}
            </div>
            <ShiftTables report={report} tab={tab} />
          </section>
        </>
      )}

      <section className="lx-card">
        <div className="lx-card-head">
          <div><div className="lx-card-title">Past shifts</div><div className="lx-card-sub">Closed shifts are locked. Open one to see or print its Z report.</div></div>
        </div>
        {history.length === 0 ? <div className="lx-empty">No closed shifts yet.</div> : (
          <div className="lx-bill-list">
            {history.map((shift) => (
              <button key={shift.id} type="button" className="lx-bill-row lx-shift-row" onClick={() => void openReport(shift.id)}>
                <span className="lx-bill-time"><strong>{shift.shiftNo}</strong><em>{time(shift.closedAt)}</em></span>
                <span className="lx-bill-main"><strong>{shift.bills ?? 0} bills · {money(shift.netSales)}</strong><em>Opened by {shift.openedBy} · closed by {shift.closedBy ?? "—"} · banked {money(shift.cashBanked)}</em></span>
                <span className={`lx-stock-badge ${Math.abs(shift.cashDifference ?? 0) < 0.005 ? "ok" : (shift.cashDifference ?? 0) > 0 ? "low" : "out"}`}>{diffText(shift.cashDifference ?? 0)}</span>
                <span className="lx-bill-print"><IconInvoice /></span>
              </button>
            ))}
          </div>
        )}
      </section>

      {entryModal && (
        <CashEntryModal
          token={token}
          direction={entryModal}
          drawerOnly={admin.role === "CASHIER"}
          shiftOpen={Boolean(open)}
          onClose={() => setEntryModal(null)}
          onSaved={(entry) => { setEntryModal(null); flash(`${entry.entryNo} saved — ${entry.categoryLabel} ${money(entry.amount)}`); void load(); }}
        />
      )}

      {closing && open && current && (
        <CloseShiftWizard
          api={api}
          shiftId={open.id}
          shiftNo={open.shiftNo}
          openingFloat={open.openingFloat}
          denominations={current.denominations}
          stockBook={report?.stockBook ?? []}
          onCancel={() => { setClosing(false); void load(); }}
          onClosed={(closed) => { setClosing(false); setViewing(closed); flash(`Shift ${open.shiftNo} closed`); void load(); }}
        />
      )}

      {viewing && (
        <div className="bm-modal-backdrop" onClick={() => setViewing(null)}>
          <div className="lx-report-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Day End report">
            <div className="lx-report-head">
              <div>
                <strong>{viewing.shift.status === "CLOSED" ? "Day End report" : "Shift report so far"} · {viewing.shift.shiftNo}</strong>
                <span>{money(viewing.sales.netSales)} net sales · {viewing.close ? diffText(viewing.close.difference) : "not closed yet"}</span>
              </div>
              <div className="lx-report-actions">
                <button type="button" className="btn-outline" onClick={() => printZReport(viewing)} title="Short version for the 80mm till printer">Till slip (80mm)</button>
                <button type="button" className="btn-accent" onClick={() => printDayEndReport(viewing)}><IconPrinter size={16} /> Print A4 / Save PDF</button>
                <button type="button" className="btn-outline" onClick={() => setViewing(null)}>Close</button>
              </div>
            </div>
            <iframe className="lx-report-frame" title="Day End report preview" srcDoc={buildDayEndReportHtml(viewing)} />
          </div>
        </div>
      )}

      {toast && <div className="lx-toasts"><div className="lx-toast ok"><span className="lx-toast-icon"><IconCheck size={16} /></span><div><strong>{toast}</strong></div></div></div>}
    </div>
  );
}

function ShiftTables({ report, tab }: { report: ShiftReport; tab: ShiftTab }) {
  if (tab === "bills") {
    return report.sales.billList.length === 0 ? <div className="lx-empty">No sales yet in this shift.</div> : (
      <div className="data-table-wrap"><table className="data-table">
        <thead><tr><th>Time</th><th>Bill</th><th>Sold by</th><th>Customer</th><th>Items</th><th>Payment</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
        <tbody>{[...report.sales.billList].reverse().map((bill) => (
          <tr key={bill.billNo}>
            <td className="td-muted">{new Date(bill.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
            <td className="td-muted">{bill.billNo}{bill.offline ? <span className="badge badge-warning" style={{ marginLeft: 6 }} title="Rung up while the till had no connection, uploaded later">Offline</span> : null}</td>
            <td><strong>{bill.cashier}</strong></td>
            <td>{bill.customer}</td>
            <td>{bill.items}</td>
            <td>{bill.payment}{bill.reference ? <div className="td-muted">{bill.reference}</div> : null}</td>
            <td style={{ textAlign: "right" }}>{money(bill.total)}</td>
          </tr>
        ))}</tbody>
      </table></div>
    );
  }
  if (tab === "staff") {
    return (
      <div className="data-table-wrap"><table className="data-table">
        <thead><tr><th>Staff member</th><th style={{ textAlign: "right" }}>Bills</th><th style={{ textAlign: "right" }}>Cash</th><th style={{ textAlign: "right" }}>Card</th><th style={{ textAlign: "right" }}>Transfer / QR</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
        <tbody>{report.sales.byStaff.map((row) => (
          <tr key={row.name}><td><strong>{row.name}</strong></td><td style={{ textAlign: "right" }}>{row.bills}</td><td style={{ textAlign: "right" }}>{money(row.cash)}</td><td style={{ textAlign: "right" }}>{money(row.card)}</td><td style={{ textAlign: "right" }}>{money(row.transfer ?? 0)}</td><td style={{ textAlign: "right" }}>{money(row.total)}</td></tr>
        ))}{report.sales.byStaff.length === 0 && <tr><td colSpan={6} className="bm-table-empty">No sales yet.</td></tr>}</tbody>
      </table></div>
    );
  }
  if (tab === "items") {
    const byType = report.sales.byType;
    return (
      <>
      {byType && (
        <div className="lx-book-totals" style={{ padding: "0 0.4rem 0.75rem" }}>
          <span>Hard liquor<b>{byType.hardLiquor.units} btl{byType.hardLiquor.amount != null ? ` · ${money(byType.hardLiquor.amount)}` : ""}</b></span>
          <span>Beer, wine &amp; others<b>{byType.other.units}{byType.other.amount != null ? ` · ${money(byType.other.amount)}` : ""}</b></span>
        </div>
      )}
      <div className="data-table-wrap"><table className="data-table">
        <thead><tr><th>Item</th><th style={{ textAlign: "right" }}>Sold</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
        <tbody>{report.sales.byProduct.map((row) => (
          <tr key={row.name}><td>{row.name}</td><td style={{ textAlign: "right" }}>{row.units}</td><td style={{ textAlign: "right" }}>{money(row.amount)}</td></tr>
        ))}{report.sales.byProduct.length === 0 && <tr><td colSpan={3} className="bm-table-empty">Nothing sold yet.</td></tr>}</tbody>
      </table></div>
      </>
    );
  }
  if (tab === "payments") {
    const payments = report.payments;
    if (!payments) return <div className="lx-empty">This shift's report has no payment breakdown.</div>;
    return (
      <>
        <div className="data-table-wrap"><table className="data-table">
          <thead><tr><th>Paid by</th><th style={{ textAlign: "right" }}>Bills</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>
            {payments.rows.map((row) => <tr key={row.method}><td><strong>{row.method}</strong></td><td style={{ textAlign: "right" }}>{row.bills}</td><td style={{ textAlign: "right" }}>{money(row.amount)}</td></tr>)}
            {payments.wallet && payments.wallet.amount > 0 && <tr><td><strong>Part paid from customer wallets</strong></td><td style={{ textAlign: "right" }}>{payments.wallet.bills}</td><td style={{ textAlign: "right" }}>{money(payments.wallet.amount)}</td></tr>}
            {payments.vouchers && payments.vouchers.amount > 0 && <tr><td><strong>Part paid with gift vouchers</strong>{payments.vouchers.free > 0 && <div className="td-muted">of which free vouchers {money(payments.vouchers.free)}</div>}</td><td style={{ textAlign: "right" }}>{payments.vouchers.bills}</td><td style={{ textAlign: "right" }}>{money(payments.vouchers.amount)}</td></tr>}
            <tr><td className="td-muted">Money actually received</td><td /><td style={{ textAlign: "right" }} className="td-muted">cash {money(report.sales.cashSales)} · card {money(report.sales.cardSales)} · QR {money(report.sales.transferSales ?? 0)}</td></tr>
            {(report.sales.walletKept ?? 0) !== 0 && <tr><td className="td-muted">Change kept in customer wallets (stayed in the drawer)</td><td /><td style={{ textAlign: "right" }} className="td-muted">{money(report.sales.walletKept)}</td></tr>}
            <tr><td className="td-muted">Change given back</td><td /><td style={{ textAlign: "right" }} className="td-muted">{money(payments.changeGiven)}</td></tr>
          </tbody>
        </table></div>
        <div className="lx-card-head" style={{ margin: "1rem 0.4rem 0.4rem" }}><div><div className="lx-card-title">Split bills</div><div className="lx-card-sub">Bills paid partly in cash and partly by card or QR</div></div></div>
        {payments.splitBills.length === 0 ? <div className="lx-empty">No split bills in this shift.</div> : (
          <div className="data-table-wrap"><table className="data-table">
            <thead><tr><th>Time</th><th>Bill</th><th>Sold by</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Cash</th><th style={{ textAlign: "right" }}>Card</th><th style={{ textAlign: "right" }}>QR</th><th>Approval / ref</th></tr></thead>
            <tbody>{[...payments.splitBills].reverse().map((row) => (
              <tr key={row.billNo}>
                <td className="td-muted">{new Date(row.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
                <td className="td-muted">{row.billNo}</td>
                <td><strong>{row.cashier}</strong></td>
                <td style={{ textAlign: "right" }}>{money(row.total)}</td>
                <td style={{ textAlign: "right" }}>{money(row.cash)}</td>
                <td style={{ textAlign: "right" }}>{row.card ? money(row.card) : "—"}</td>
                <td style={{ textAlign: "right" }}>{row.transfer ? money(row.transfer) : "—"}</td>
                <td className="td-muted">{row.reference ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </>
    );
  }
  if (tab === "wallets") {
    const wallet = report.wallet;
    if (!wallet) return <div className="lx-empty">This shift's report has no wallet detail.</div>;
    return (
      <>
        <div className="lx-book-totals" style={{ padding: "0 0.4rem 0.75rem" }}>
          <span>Change kept in wallets<b>{money(wallet.kept)}</b></span>
          <span>Spent from wallets<b>{money(wallet.used)}</b></span>
          {wallet.refunded ? <span>Refunds into wallets<b>{money(wallet.refunded)}</b></span> : null}
          <span>Members<b>{new Set(wallet.rows.map((row) => row.mobile)).size}</b></span>
        </div>
        {wallet.rows.length === 0 ? <div className="lx-empty">No wallet activity in this shift.</div> : (
          <div className="data-table-wrap"><table className="data-table">
            <thead><tr><th>Time</th><th>Member</th><th>What</th><th>Bill</th><th>Served by</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Wallet after</th></tr></thead>
            <tbody>{[...wallet.rows].reverse().map((row, index) => (
              <tr key={`${row.billNo}-${row.type}-${index}`}>
                <td className="td-muted">{new Date(row.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
                <td><strong>{row.member}</strong><div className="td-muted">{row.mobile}</div></td>
                <td>{row.type === "CREDIT" ? "Change kept" : row.type === "REFUND" ? "Refund for returned bottles" : "Spent on bill"}</td>
                <td className="td-muted">{row.billNo ?? "—"}</td>
                <td>{row.by}</td>
                <td style={{ textAlign: "right" }} className={row.type === "DEBIT" ? "lx-amount-out" : "lx-amount-in"}>{row.amount == null ? "Hidden" : `${row.amount >= 0 ? "+" : "−"}${money(Math.abs(row.amount))}`}</td>
                <td style={{ textAlign: "right" }}>{money(row.balanceAfter)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </>
    );
  }
  if (tab === "goods") {
    const goods = report.goods;
    const rows = goods ? [
      ...goods.grns.map((row) => ({ key: row.grnNo, time: row.time, no: row.grnNo, what: `Received from ${row.supplier}`, sub: [row.poNumber, row.invoiceNo ? `invoice ${row.invoiceNo}` : null, row.free ? `${row.free} free issue` : null, row.rejected ? `${row.rejected} rejected` : null].filter(Boolean).join(" · "), items: row.items, by: row.by, units: row.accepted + (row.free ?? 0), sign: 1 })),
      ...goods.sent.map((row) => ({ key: `s${row.gtnNo}`, time: row.time, no: row.gtnNo, what: `Sent to ${row.branch}`, sub: row.status === "CANCELLED" ? "Cancelled — back on the shelf" : row.status === "SENT" ? "In transit" : "Received there", items: row.items, by: row.by, units: row.units, sign: -1 })),
      ...goods.received.map((row) => ({ key: `r${row.gtnNo}`, time: row.time, no: row.gtnNo, what: `Received from ${row.branch}`, sub: [row.damaged ? `${row.damaged} damaged` : null, row.missing ? `${row.missing} MISSING` : null, row.note].filter(Boolean).join(" · "), items: row.items, by: row.by, units: row.units, sign: 1 })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()) : [];
    return rows.length === 0 ? <div className="lx-empty">No supplier deliveries or branch transfers in this shift.</div> : (
      <div className="data-table-wrap"><table className="data-table">
        <thead><tr><th>Time</th><th>No</th><th>What</th><th>Items</th><th>By</th><th style={{ textAlign: "right" }}>Bottles</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.key}>
            <td className="td-muted">{new Date(row.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
            <td><strong>{row.no}</strong></td>
            <td>{row.what}{row.sub && <div className={row.sub.includes("MISSING") ? "lx-amount-out" : "td-muted"}>{row.sub}</div>}</td>
            <td className="td-muted">{row.items}</td>
            <td>{row.by}</td>
            <td style={{ textAlign: "right" }} className={row.sign > 0 ? "lx-amount-in" : "lx-amount-out"}>{row.sign > 0 ? "+" : "−"}{row.units}</td>
          </tr>
        ))}</tbody>
      </table></div>
    );
  }
  if (tab === "returns") {
    const returns = report.returns;
    if (!returns) return <div className="lx-empty">This shift&apos;s report has no returns detail.</div>;
    return (
      <>
        <div className="lx-book-totals" style={{ padding: "0 0.4rem 0.75rem" }}>
          <span>Returned &amp; refunded<b>{returns.refundUnits} btl · {returns.refundsTotal == null ? "Hidden" : money(returns.refundsTotal)}</b></span>
          <span>Cash paid back<b>{money(returns.refundsCash)}</b></span>
          <span>Into wallets<b>{money(returns.refundsWallet)}</b></span>
          <span>Damaged bottles exchanged<b>{returns.exchangedUnits}</b></span>
          <span>Damaged in store<b>{returns.storeDamagedUnits}</b></span>
          <span>Damaged stock cleared<b>{returns.clearedUnits}</b></span>
        </div>
        {returns.rows.length === 0 ? <div className="lx-empty">No returns, exchanges or damages in this shift.</div> : (
          <div className="data-table-wrap"><table className="data-table">
            <thead><tr><th>Time</th><th>No</th><th>What</th><th>Product</th><th style={{ textAlign: "right" }}>Qty</th><th>Bill / customer</th><th>Reason</th><th>By</th><th style={{ textAlign: "right" }}>Paid back</th></tr></thead>
            <tbody>{[...returns.rows].reverse().map((row, index) => (
              <tr key={`${row.returnNo}-${index}`}>
                <td className="td-muted">{new Date(row.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
                <td className="td-muted">{row.returnNo}</td>
                <td><strong>{row.what}</strong>{row.condition && <div className="td-muted">{row.condition === "SHELF" ? "Back on the shelf" : "Kept aside as damaged"}</div>}{row.disposal && <div className="td-muted">{row.disposal}</div>}</td>
                <td>{row.product}</td>
                <td style={{ textAlign: "right" }}>{row.quantity}</td>
                <td className="td-muted">{row.billNo ?? "—"}{row.customer && <div>{row.customer}</div>}</td>
                <td>{row.reason}{row.note && <div className="td-muted">{row.note}</div>}</td>
                <td>{row.by}</td>
                <td style={{ textAlign: "right" }}>{row.type === "REFUND" ? <><span className="lx-amount-out">{row.refund == null ? "Hidden" : `−${money(row.refund)}`}</span><div className="td-muted">{row.refundMethod === "WALLET" ? "to wallet" : "cash"}{row.pointsReversed ? ` · −${row.pointsReversed} pts` : ""}</div></> : "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {report.damagedStock && report.damagedStock.length > 0 && (
          <>
            <div className="lx-card-head" style={{ margin: "1rem 0.4rem 0.4rem" }}><div><div className="lx-card-title">Damaged stock kept aside</div><div className="lx-card-sub">Not for sale — sent back to the supplier or thrown away from Returns &amp; Damages</div></div></div>
            <div className="data-table-wrap"><table className="data-table">
              <thead><tr><th>Product</th><th style={{ textAlign: "right" }}>Added this shift</th><th style={{ textAlign: "right" }}>Cleared this shift</th><th style={{ textAlign: "right" }}>On hand</th></tr></thead>
              <tbody>{report.damagedStock.map((row) => (
                <tr key={row.name}><td><strong>{row.name}</strong></td><td style={{ textAlign: "right" }}>{row.added || "—"}</td><td style={{ textAlign: "right" }}>{row.cleared || "—"}</td><td style={{ textAlign: "right" }}><strong>{row.onHand}</strong></td></tr>
              ))}</tbody>
            </table></div>
          </>
        )}
      </>
    );
  }
  if (tab === "stockin") {
    const rows = report.stockLog ?? [];
    return rows.length === 0 ? <div className="lx-empty">No stock received, corrected or returned in this shift.</div> : (
      <div className="data-table-wrap"><table className="data-table">
        <thead><tr><th>Time</th><th>What</th><th>Product</th><th style={{ textAlign: "right" }}>Qty</th><th>From / reference</th><th>By</th></tr></thead>
        <tbody>{[...rows].reverse().map((row, index) => (
          <tr key={`${row.time}-${index}`}>
            <td className="td-muted">{new Date(row.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
            <td><strong>{row.what}</strong></td>
            <td>{row.product}</td>
            <td style={{ textAlign: "right" }} className={row.quantity < 0 ? "lx-amount-out" : "lx-amount-in"}>{row.quantity > 0 ? `+${row.quantity}` : row.quantity}</td>
            <td className="td-muted">{row.reference ?? "—"}</td>
            <td>{row.by}</td>
          </tr>
        ))}</tbody>
      </table></div>
    );
  }
  if (tab === "journal") {
    const rows = report.journal ?? [];
    return rows.length === 0 ? <div className="lx-empty">Nothing else was done during this shift.</div> : (
      <div className="data-table-wrap"><table className="data-table">
        <thead><tr><th>Time</th><th>Who</th><th>What happened</th></tr></thead>
        <tbody>{[...rows].reverse().map((row, index) => (
          <tr key={`${row.time}-${index}`}>
            <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{new Date(row.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
            <td><strong>{row.by}</strong></td>
            <td className={row.summary.startsWith("Blocked") ? "lx-amount-out" : ""}>{row.summary}</td>
          </tr>
        ))}</tbody>
      </table></div>
    );
  }
  if (tab === "offers") {
    const loyalty = report.sales.loyalty;
    if (!loyalty) return <div className="lx-empty">This shift's report has no discount and loyalty detail.</div>;
    const discountTotal = loyalty.rows.reduce((sum, row) => sum + (row.discountAmount ?? 0), 0);
    const pointsRedeemed = loyalty.rows.reduce((sum, row) => sum + row.pointsRedeemed, 0);
    const pointsValue = loyalty.rows.reduce((sum, row) => sum + (row.pointsValue ?? 0), 0);
    const hidden = loyalty.rows.some((row) => row.discountAmount == null);
    return (
      <>
        <div className="lx-book-totals" style={{ padding: "0 0.4rem 0.75rem" }}>
          <span>Discounted bills<b>{loyalty.discountBills}</b></span>
          <span>Discounts given<b>{hidden ? "Hidden" : money(discountTotal)}</b></span>
          <span>Member bills<b>{loyalty.memberBills}</b></span>
          <span>Points used<b>{pointsRedeemed}{hidden || !pointsRedeemed ? "" : ` · ${money(pointsValue)}`}</b></span>
          <span>Points earned<b>{loyalty.pointsEarned}</b></span>
          {loyalty.discountByStaff.map((row) => <span key={row.name}>Discounts by {row.name} ({row.bills})<b>{row.amount == null ? "Hidden" : money(row.amount)}</b></span>)}
        </div>
        {loyalty.rows.length === 0 ? <div className="lx-empty">No discounts or loyalty points in this shift.</div> : (
          <div className="data-table-wrap"><table className="data-table">
            <thead><tr><th>Time</th><th>Bill</th><th>Sold by</th><th>Member</th><th style={{ textAlign: "right" }}>Bill before</th><th>Discount</th><th style={{ textAlign: "right" }}>Points used</th><th style={{ textAlign: "right" }}>Points earned</th><th style={{ textAlign: "right" }}>Paid</th></tr></thead>
            <tbody>{[...loyalty.rows].reverse().map((row) => (
              <tr key={row.billNo}>
                <td className="td-muted">{new Date(row.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
                <td className="td-muted">{row.billNo}</td>
                <td><strong>{row.cashier}</strong></td>
                <td>{row.member ?? "Walk-in"}</td>
                <td style={{ textAlign: "right" }}>{money(row.billBefore)}</td>
                <td>{row.discountType ? <><span className="lx-amount-out">−{money(row.discountAmount)}</span><div className="td-muted">{discountText(row)}</div></> : "—"}</td>
                <td style={{ textAlign: "right" }}>{row.pointsRedeemed ? <><span className="lx-amount-out">{row.pointsRedeemed}</span><div className="td-muted">−{money(row.pointsValue)}</div></> : "—"}</td>
                <td style={{ textAlign: "right" }}>{row.pointsEarned ? <span className="lx-amount-in">+{row.pointsEarned}</span> : "—"}</td>
                <td style={{ textAlign: "right" }}>{money(row.total)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </>
    );
  }
  if (tab === "vouchers") {
    const gv = report.giftVouchers;
    if (!gv) return <div className="lx-empty">Gift vouchers weren't recorded for this shift (closed before they were added).</div>;
    if (!gv.issued.length && !gv.used.length) return <div className="lx-empty">No gift vouchers were sold, given or used in this shift.</div>;
    return (
      <>
        <div className="rt-kpis" style={{ margin: "0 0.4rem 0.8rem" }}>
          <div className="rt-kpi"><span>Sold</span><strong>{gv.soldTotal == null ? "Hidden" : money(gv.soldTotal)}</strong><em>{gv.soldCount} voucher(s){gv.soldCash ? ` · cash ${money(gv.soldCash)}` : ""}{gv.soldCard ? ` · card ${money(gv.soldCard)}` : ""}{gv.soldTransfer ? ` · QR ${money(gv.soldTransfer)}` : ""}</em></div>
          <div className="rt-kpi"><span>Given free</span><strong>{money(gv.freeTotal)}</strong><em>{gv.freeCount} voucher(s)</em></div>
          <div className="rt-kpi"><span>Used on bills</span><strong>{money(gv.usedTotal)}</strong><em>{gv.used.length} voucher(s){gv.usedFree ? ` · free ${money(gv.usedFree)}` : ""}</em></div>
        </div>
        {gv.issued.length > 0 && (
          <div className="data-table-wrap"><table className="data-table">
            <thead><tr><th>Issued</th><th>Voucher</th><th>Type</th><th>For</th><th>By</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>{gv.issued.map((row) => (
              <tr key={`i-${row.voucherNo}`}>
                <td className="td-muted">{hhmm(row.issuedAt)}</td>
                <td><strong>{row.voucherNo}</strong><div className="td-muted">{row.code}</div></td>
                <td>{row.kind === "FREE" ? <>Free<div className="td-muted">{row.note}</div></> : <>Sold · {row.paymentLabel}{row.paymentReference ? <div className="td-muted">{row.paymentReference}</div> : null}</>}</td>
                <td>{row.issuedTo ?? "—"}</td>
                <td>{row.issuedBy}</td>
                <td style={{ textAlign: "right" }}>{row.amount == null ? "—" : money(row.amount)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {gv.used.length > 0 && (
          <div className="data-table-wrap" style={{ marginTop: "0.8rem" }}><table className="data-table">
            <thead><tr><th>Used</th><th>Voucher</th><th>Type</th><th>Bill</th><th>Issued at</th><th>Cashier</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>{gv.used.map((row) => (
              <tr key={`u-${row.voucherNo}`}>
                <td className="td-muted">{row.redeemedAt ? hhmm(row.redeemedAt) : ""}</td>
                <td><strong>{row.voucherNo}</strong><div className="td-muted">{row.code}</div></td>
                <td>{row.kind === "FREE" ? "Free" : "Sold"}</td>
                <td className="td-muted">{row.redeemedBillNo}</td>
                <td>{row.issueBranch}{row.issueBranch !== row.redeemedBranch ? <div className="td-muted">other branch</div> : null}</td>
                <td>{row.redeemedBy}</td>
                <td style={{ textAlign: "right" }}>{row.amount == null ? "—" : money(row.amount)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </>
    );
  }
  if (tab === "drawer") {
    const drawer = report.drawer;
    if (!drawer) return <div className="lx-empty">Drawer openings were not recorded for this shift (closed before this was added).</div>;
    return (
      <>
        <div className="rt-kpis" style={{ margin: "0 0.4rem 0.8rem" }}>
          <div className="rt-kpi"><span>With a cash bill</span><strong>{drawer.cashBills}</strong></div>
          <div className={`rt-kpi${drawer.noSaleCount ? " warn" : ""}`}><span>Without a sale</span><strong>{drawer.noSaleCount}</strong></div>
        </div>
        {drawer.noSale.length === 0 ? <div className="lx-empty">The drawer was not opened without a sale this shift.</div> : (
          <div className="data-table-wrap"><table className="data-table">
            <thead><tr><th>Time</th><th>No</th><th>Opened by</th><th>Reason</th></tr></thead>
            <tbody>{[...drawer.noSale].reverse().map((row) => (
              <tr key={row.openNo}>
                <td className="td-muted">{hhmm(row.at)}</td>
                <td className="td-muted">{row.openNo}</td>
                <td>{row.openedBy}</td>
                <td><strong>{row.reason}</strong></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </>
    );
  }
  if (tab === "cash") {
    const entries = report.cash.entries.filter((entry) => !entry.automatic);
    return entries.length === 0 ? <div className="lx-empty">No expenses or cash in recorded this shift.</div> : (
      <div className="data-table-wrap"><table className="data-table">
        <thead><tr><th>Time</th><th>No</th><th>What</th><th>Paid to / from</th><th>From / into</th><th>Recorded by</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
        <tbody>{[...entries].reverse().map((entry) => (
          <tr key={entry.entryNo} className={entry.voided ? "lx-void-row" : ""}>
            <td className="td-muted">{new Date(entry.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
            <td className="td-muted">{entry.entryNo}</td>
            <td><strong>{entry.category}</strong>{entry.note ? <div className="td-muted">{entry.note}</div> : null}{entry.voided ? <div className="td-muted">Voided by {entry.voidedBy}: {entry.voidReason}</div> : null}</td>
            <td>{entry.party ?? "—"}</td>
            <td>{entry.source}</td>
            <td>{entry.recordedBy}</td>
            <td style={{ textAlign: "right" }} className={entry.direction === "OUT" ? "lx-amount-out" : "lx-amount-in"}>{entry.direction === "OUT" ? "−" : "+"}{money(entry.amount)}</td>
          </tr>
        ))}</tbody>
      </table></div>
    );
  }
  const rows = report.stockBook.filter((row) => row.opening || row.received || row.sold || row.adjusted || row.returned || row.damaged || row.transferIn || row.transferOut || row.closing);
  const returnCols = rows.some((row) => row.returned || row.damaged);
  const transferCols = rows.some((row) => row.transferIn || row.transferOut);
  return (
    <div className="data-table-wrap"><table className="data-table">
      <thead><tr><th>Product</th><th style={{ textAlign: "right" }}>Opening</th><th style={{ textAlign: "right" }}>+ Received</th><th style={{ textAlign: "right" }}>− Sold</th>{transferCols && <><th style={{ textAlign: "right" }}>+ From branch</th><th style={{ textAlign: "right" }}>− To branch</th></>}{returnCols && <><th style={{ textAlign: "right" }}>+ Returned</th><th style={{ textAlign: "right" }}>− Damaged</th></>}<th style={{ textAlign: "right" }}>± Adjusted</th><th style={{ textAlign: "right" }}>Closing</th></tr></thead>
      <tbody>{rows.map((row) => (
        <tr key={row.productId}><td><strong>{row.name}</strong><div className="td-muted">{row.brand}{row.size ? ` · ${row.size}` : ""}</div></td><td style={{ textAlign: "right" }}>{row.opening}</td><td style={{ textAlign: "right" }}>{row.received || "—"}</td><td style={{ textAlign: "right" }}>{row.sold || "—"}</td>{transferCols && <><td style={{ textAlign: "right" }}>{row.transferIn || "—"}</td><td style={{ textAlign: "right" }}>{row.transferOut || "—"}</td></>}{returnCols && <><td style={{ textAlign: "right" }}>{row.returned || "—"}</td><td style={{ textAlign: "right" }}>{row.damaged || "—"}</td></>}<td style={{ textAlign: "right" }}>{row.adjusted || "—"}</td><td style={{ textAlign: "right" }}><strong>{row.closing}</strong></td></tr>
      ))}</tbody>
    </table></div>
  );
}

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
type PayRow = NonNullable<ShiftReport["sales"]["cardPayments"]>[number];
const STEPS = ["Count cash", "Card & QR", "Check", "Stock count", "Close"];
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

function CloseShiftWizard({ api, shiftId, shiftNo, openingFloat, denominations, stockBook, onCancel, onClosed }: {
  api: Api; shiftId: number; shiftNo: string; openingFloat: number; denominations: number[];
  stockBook: ShiftReport["stockBook"]; onCancel: () => void; onClosed: (report: ShiftReport) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CountResult | null>(null);
  const [reason, setReason] = useState("");
  const [cardPayments, setCardPayments] = useState<PayRow[] | null>(null);
  const [transferPayments, setTransferPayments] = useState<PayRow[]>([]);
  const [cardSlip, setCardSlip] = useState("");
  const [notSettled, setNotSettled] = useState(false);
  const [cardReason, setCardReason] = useState("");
  const [floatLeft, setFloatLeft] = useState(String(openingFloat));
  const [notes, setNotes] = useState("");
  const [stockCounts, setStockCounts] = useState<Record<number, string>>({});
  // Rows confirmed with the ✓ button (count equals the system); typed counts are kept separately.
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Card / QR payments are recorded automatically with each bill; load the latest list to check.
  const loadPayments = useCallback(async () => {
    try {
      const data = await api<{ report: ShiftReport }>(`/shifts/${shiftId}/report`);
      setCardPayments(data.report.sales.cardPayments ?? []);
      setTransferPayments(data.report.sales.transferPayments ?? []);
    } catch {
      setCardPayments([]);
    }
  }, [api, shiftId]);
  useEffect(() => { void loadPayments(); }, [loadPayments]);

  const total = denominations.reduce((sum, note) => sum + note * (Math.floor(Number(counts[note] || 0)) || 0), 0);
  const floatNumber = Number(floatLeft || 0);
  const needsReason = result ? Math.abs(result.difference) >= 0.005 : false;
  const stockRows = stockBook.filter((row) => row.closing || row.sold || row.received);
  const cardTotal = (cardPayments ?? []).reduce((sum, row) => sum + row.amount, 0);
  const transferTotal = transferPayments.reduce((sum, row) => sum + row.amount, 0);
  const slipEntered = cardSlip.trim() !== "" && !notSettled;
  const cardDiff = slipEntered ? Math.round((Number(cardSlip) - cardTotal) * 100) / 100 : 0;
  const cardMismatch = slipEntered && Math.abs(cardDiff) >= 0.005;
  const hasCards = (cardPayments?.length ?? 0) > 0;
  // With card sales, either enter the settlement total or mark the machine as not settled yet.
  const cardStepDone = !hasCards || notSettled || slipEntered;
  const cardStepValid = cardStepDone && (!cardMismatch || cardReason.trim().length > 0);

  const saveCount = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, number> = {};
      denominations.forEach((note) => { const qty = Math.floor(Number(counts[note] || 0)); if (qty > 0) payload[note] = qty; });
      setResult(await api<CountResult>(`/shifts/${shiftId}/count`, { method: "POST", body: JSON.stringify({ counts: payload }) }));
      void loadPayments();
      setStep(2);
    } catch (countError) {
      setError(countError instanceof Error ? countError.message : "Could not save the count");
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ report: ShiftReport }>(`/shifts/${shiftId}/close`, {
        method: "POST",
        body: JSON.stringify({
          floatLeft: floatNumber,
          differenceReason: reason || undefined,
          cardSlipTotal: slipEntered ? Number(cardSlip) : undefined,
          cardDifferenceReason: notSettled ? (cardReason.trim() || "Card machine not settled at close") : cardReason.trim() || undefined,
          notes: notes || undefined,
          stockCounts: Object.entries(stockCounts).filter(([, value]) => value.trim() !== "").map(([productId, value]) => ({ productId: Number(productId), counted: Math.floor(Number(value)) })),
        }),
      });
      onClosed(data.report);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Could not close the shift");
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const payList = (rows: PayRow[], refLabel: string) => (
    <div className="lx-paylist">
      <div className="lx-paylist-row head"><span>Time</span><span>Bill</span><span>Taken by</span><span>{refLabel}</span><span>Amount</span></div>
      {rows.map((row) => (
        <div key={row.billNo} className="lx-paylist-row">
          <span>{hhmm(row.time)}</span><span className="mono">{row.billNo.slice(-9)}</span><span>{row.cashier}</span>
          <span className={row.reference ? "mono" : "muted"}>{row.reference ?? "—"}</span><span>{money(row.amount)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="bm-modal-backdrop">
      <div className="bm-modal lx-close-modal" role="dialog" aria-label={`Close shift ${shiftNo}`}>
        <div className="lx-close-steps">
          {STEPS.map((label, index) => (
            <span key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""}><b>{step > index + 1 ? "✓" : index + 1}</b>{label}</span>
          ))}
        </div>

        {step === 1 && (
          <>
            <h3 className="bm-modal-title">Count the cash in the drawer</h3>
            <p className="lx-card-sub">Count notes and coins only. Card and QR payments are not in the drawer. They were recorded automatically with each bill and you check them in the next step.</p>
            <div className="lx-denoms">
              {denominations.map((note) => (
                <label key={note} className="lx-denom">
                  <span>Rs. {note.toLocaleString()}</span>
                  <b>×</b>
                  <input className="bm-input" type="number" min={0} step="1" inputMode="numeric" value={counts[note] ?? ""} onChange={(event) => setCounts({ ...counts, [note]: event.target.value })} placeholder="0" />
                  <em>{money(note * (Math.floor(Number(counts[note] || 0)) || 0))}</em>
                </label>
              ))}
            </div>
            <div className="lx-count-total"><span>Counted cash</span><strong>{money(total)}</strong></div>
            {error && <div className="bm-alert bm-alert-error">{error}</div>}
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
              <button type="button" className="btn-accent" disabled={busy} onClick={() => void saveCount()}>{busy ? "Saving…" : "Save count"}</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="bm-modal-title">Card &amp; QR payments</h3>
            <div className="lx-card-check">
              <div className="lx-card-check-head">
                <div><strong>Card payments</strong><span>Recorded automatically at the till</span></div>
                <b>{cardPayments == null ? "…" : `${cardPayments.length} · ${money(cardTotal)}`}</b>
              </div>
              {hasCards ? (
                <>
                  {payList(cardPayments ?? [], "Approval code")}
                  <div className="lx-settle">
                    <p>On the card machine, print the <b>settlement</b> (end-of-day / batch total) slip and enter its <b>sale total</b>.</p>
                    <div className="lx-settle-row">
                      <input className="bm-input lx-entry-amount" type="number" min={0} step="0.01" placeholder="Settlement slip total" value={cardSlip} disabled={notSettled} onChange={(event) => setCardSlip(event.target.value)} />
                      <label className="lx-check"><input type="checkbox" checked={notSettled} onChange={(event) => { setNotSettled(event.target.checked); if (event.target.checked) setCardSlip(""); }} /> Not settled yet</label>
                    </div>
                    {slipEntered && (
                      <div className={`lx-settle-result ${cardMismatch ? "bad" : "ok"}`}>
                        {cardMismatch
                          ? `Card machine is ${cardDiff > 0 ? "more" : "less"} than the till by ${money(Math.abs(cardDiff))}. Check for a missed or duplicate card bill.`
                          : "✓ Card machine matches the card sales"}
                      </div>
                    )}
                    {(cardMismatch || notSettled) && (
                      <label className="lx-settle-reason">{notSettled ? "Note (optional)" : "What happened? *"}
                        <input className="bm-input" value={cardReason} onChange={(event) => setCardReason(event.target.value)} placeholder={notSettled ? "e.g. machine settles automatically at midnight" : "e.g. card bill 3SC4 was entered as cash"} />
                      </label>
                    )}
                  </div>
                </>
              ) : <div className="lx-empty" style={{ padding: "0.75rem" }}>{cardPayments == null ? "Loading…" : "No card payments in this shift."}</div>}
            </div>

            {transferPayments.length > 0 && (
              <div className="lx-card-check">
                <div className="lx-card-check-head">
                  <div><strong>Bank transfer / QR</strong><span>Check each one arrived in the bank app</span></div>
                  <b>{transferPayments.length} · {money(transferTotal)}</b>
                </div>
                {payList(transferPayments, "Reference")}
              </div>
            )}
            {error && <div className="bm-alert bm-alert-error">{error}</div>}
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn-accent" disabled={!cardStepValid} onClick={() => setStep(3)}>{!cardStepDone ? "Enter the slip total" : "Next"}</button>
            </div>
          </>
        )}

        {step === 3 && result && (
          <>
            <h3 className="bm-modal-title">Check the drawer</h3>
            <div className="lx-close-result">
              <div><span>Counted</span><strong>{money(result.countedCash)}</strong></div>
              <div><span>Expected</span><strong>{money(result.expectedCash)}</strong></div>
              <div className={Math.abs(result.difference) < 0.005 ? "ok" : result.difference > 0 ? "over" : "short"}><span>Result</span><strong>{diffText(result.difference)}</strong></div>
            </div>
            {hasCards && (
              <div className={`lx-settle-result ${notSettled ? "warn" : cardMismatch ? "bad" : "ok"}`}>
                Card: {money(cardTotal)} · {notSettled ? "card machine not settled yet" : cardMismatch ? `machine differs by ${money(Math.abs(cardDiff))}` : "matches the card machine"}
              </div>
            )}
            <div className="lx-member-grid">
              {needsReason && (
                <label className="wide">Why is the drawer {result.difference > 0 ? "over" : "short"}? *
                  <input className="bm-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. gave extra change by mistake" autoFocus />
                </label>
              )}
              <label>Float to leave for the next shift
                <input className="bm-input" type="number" min={0} step="0.01" value={floatLeft} onChange={(event) => setFloatLeft(event.target.value)} />
              </label>
              <label>Cash to bank / safe
                <input className="bm-input" value={money(Math.max(0, result.countedCash - floatNumber))} readOnly tabIndex={-1} />
              </label>
              <label className="wide">Notes<input className="bm-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything the manager should know" /></label>
            </div>
            {error && <div className="bm-alert bm-alert-error">{error}</div>}
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => { setStep(1); setError(null); }}>Recount</button>
              <button type="button" className="btn-accent" disabled={(needsReason && !reason.trim()) || floatNumber > result.countedCash || floatNumber < 0} onClick={() => setStep(4)}>Next</button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h3 className="bm-modal-title">Stock count <span className="lx-card-sub">(optional)</span></h3>
            <p className="lx-card-sub">Check the bottles on the shelves. Tap <b>✓</b> when the count matches the system. If it doesn't, type the number you counted. Rows left empty are skipped.</p>
            {(() => {
              const checked = stockRows.filter((row) => (stockCounts[row.productId] ?? "").trim() !== "");
              const differences = checked.filter((row) => Math.floor(Number(stockCounts[row.productId])) !== row.closing);
              return (
                <div className="lx-stockcount-bar">
                  <span><b>{checked.length}</b> of {stockRows.length} checked{differences.length ? <> · <em className="bad">{differences.length} difference{differences.length === 1 ? "" : "s"}</em></> : checked.length ? <> · <em className="ok">all match</em></> : null}</span>
                  <button type="button" className="btn-outline btn-sm" onClick={() => {
                    const untouched = stockRows.filter((row) => !stockCounts[row.productId]?.trim());
                    setStockCounts({ ...stockCounts, ...Object.fromEntries(untouched.map((row) => [row.productId, String(row.closing)])) });
                    setTicked(new Set([...ticked, ...untouched.map((row) => row.productId)]));
                  }} title="Tick every row not counted yet">✓ All match</button>
                  {checked.length > 0 && <button type="button" className="btn-outline btn-sm" onClick={() => { setStockCounts({}); setTicked(new Set()); }}>Clear</button>}
                </div>
              );
            })()}
            <div className="lx-stockcount">
              {stockRows.map((row) => {
                const value = stockCounts[row.productId] ?? "";
                const diff = value.trim() === "" ? null : Math.floor(Number(value)) - row.closing;
                const matched = diff === 0;
                const isTicked = ticked.has(row.productId);
                const tick = () => {
                  const next = new Set(ticked);
                  if (isTicked) { next.delete(row.productId); setStockCounts({ ...stockCounts, [row.productId]: "" }); }
                  else { next.add(row.productId); setStockCounts({ ...stockCounts, [row.productId]: String(row.closing) }); }
                  setTicked(next);
                };
                const type = (next: string) => {
                  if (isTicked) { const rest = new Set(ticked); rest.delete(row.productId); setTicked(rest); }
                  setStockCounts({ ...stockCounts, [row.productId]: next });
                };
                return (
                  <div key={row.productId} className={`lx-stockcount-row ${diff == null ? "" : matched ? "is-ok" : "is-bad"}`}>
                    <span><strong>{row.name}</strong><em>System: {row.closing}</em></span>
                    <button type="button" className={`lx-tick ${isTicked ? "on" : ""}`} aria-pressed={isTicked} aria-label={`${row.name} matches ${row.closing}`} title="Count matches the system" onClick={tick}>✓</button>
                    <input className="bm-input" type="number" min={0} step="1" inputMode="numeric" aria-label={`${row.name} counted`} value={isTicked ? "" : value} onChange={(event) => type(event.target.value)} placeholder={isTicked ? String(row.closing) : "Count"} />
                    <b className={diff == null ? "" : matched ? "ok" : "bad"}>{diff == null ? "" : matched ? "Match" : diff > 0 ? `+${diff}` : diff}</b>
                  </div>
                );
              })}
            </div>
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setStep(3)}>Back</button>
              <button type="button" className="btn-accent" onClick={() => setStep(5)}>Next</button>
            </div>
          </>
        )}

        {step === 5 && result && (
          <>
            <h3 className="bm-modal-title">Close shift {shiftNo}?</h3>
            <p className="lx-card-sub">After closing, this shift is locked: its figures can't change and new sales need a new shift. Takings go into Money In (Receipts) as "waiting to be banked" until someone confirms the deposit.</p>
            <div className="lx-close-result">
              <div><span>Cash to bank / safe</span><strong>{money(Math.max(0, result.countedCash - floatNumber))}</strong></div>
              <div><span>Card sales</span><strong>{money(cardTotal)}</strong></div>
              <div><span>Transfer / QR</span><strong>{money(transferTotal)}</strong></div>
            </div>
            {error && <div className="bm-alert bm-alert-error">{error}</div>}
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setStep(4)}>Back</button>
              <button type="button" className="btn-accent" disabled={busy} onClick={() => void close()}>{busy ? "Closing…" : "Close shift & see report"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
