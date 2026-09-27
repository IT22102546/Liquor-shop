"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { discountText } from "../../lib/bookPrint";
import { IconChevronLeft, IconChevronRight, IconPrinter, IconRefresh, IconTrend } from "../../lib/icons";
import {
  buildPeriodReportHtml, PERIOD_TITLES, periodLabel, periodRange, printPeriodReport, stepAnchor, trendLabel,
  type PeriodKind, type PeriodReport,
} from "../../lib/periodReport";

const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toLocaleDateString("en-CA");
const KINDS: Array<{ value: PeriodKind; label: string }> = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

export default function ReportsPage() {
  const { token, logout } = useAdmin();
  const [kind, setKind] = useState<PeriodKind>("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [custom, setCustom] = useState({ from: today(), to: today() });
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const range = useMemo(() => (kind === "custom" ? custom : periodRange(kind, anchor)), [kind, anchor, custom]);
  const isCurrent = kind !== "custom" && periodRange(kind, new Date()).from === range.from;

  const load = useCallback(async () => {
    if (!range.from || !range.to || range.from > range.to) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/pos/reports/period?from=${range.from}&to=${range.to}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (response.status === 401) { logout(); return; }
      const payload = (await response.json()) as { data?: PeriodReport; message?: string; errors?: Record<string, string[]> };
      if (!response.ok || !payload.data) throw new Error((payload.errors && Object.values(payload.errors)[0]?.[0]) ?? payload.message ?? "Could not load the report");
      setReport(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the report");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, token, logout]);

  useEffect(() => { void load(); }, [load]);

  const trend = report ? (report.period.grouping === "HOUR" ? report.trend.filter((row) => row.bills || row.expenses) : report.trend) : [];
  const maxTrend = Math.max(1, ...trend.map((row) => row.netSales));
  const label = periodLabel(kind, range.from, range.to);

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconTrend /></div>
          <div>
            <h2 className="page-title">Reports</h2>
            <p className="page-subtitle">Daily, weekly, monthly and yearly sales, profit, expenses, shifts and stock — ready to print as an A4 report.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn-outline" onClick={() => void load()}><IconRefresh size={16} /> Refresh</button>
          <button type="button" className="btn-accent" disabled={!report} onClick={() => setPreview(true)}><IconPrinter size={16} /> View &amp; print report</button>
        </div>
      </div>

      <section className="lx-card lx-period-bar">
        <div className="lx-seg-plain" role="tablist" aria-label="Report period">
          {KINDS.map((item) => (
            <button key={item.value} type="button" role="tab" aria-selected={kind === item.value} className={kind === item.value ? "active" : ""} onClick={() => { setKind(item.value); setAnchor(new Date()); }}>{item.label}</button>
          ))}
        </div>
        {kind === "custom" ? (
          <div className="lx-period-custom">
            <label>From<input className="bm-input" type="date" value={custom.from} max={custom.to} onChange={(event) => setCustom({ ...custom, from: event.target.value })} /></label>
            <label>To<input className="bm-input" type="date" value={custom.to} min={custom.from} max={today()} onChange={(event) => setCustom({ ...custom, to: event.target.value })} /></label>
          </div>
        ) : (
          <div className="lx-period-nav">
            <button type="button" className="btn-outline btn-sm" aria-label="Previous period" onClick={() => setAnchor(stepAnchor(kind, anchor, -1))}><IconChevronLeft /></button>
            <strong>{label}</strong>
            <button type="button" className="btn-outline btn-sm" aria-label="Next period" disabled={isCurrent} onClick={() => setAnchor(stepAnchor(kind, anchor, 1))}><IconChevronRight /></button>
            {!isCurrent && <button type="button" className="lx-link-btn" onClick={() => setAnchor(new Date())}>Back to {kind === "day" ? "today" : `this ${kind}`}</button>}
          </div>
        )}
      </section>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      {report && (
        <div className={`lx-period-body ${loading ? "loading" : ""}`}>
          <div className="lx-shift-kpis">
            <div><span>Net sales</span><strong>{money(report.sales.netSales)}</strong><em>{report.sales.bills} bills · {report.sales.units} units · avg {money(report.sales.averageBill)}</em></div>
            <div><span>Gross profit</span><strong>{money(report.profit.grossProfit)}</strong><em>{report.profit.margin}% margin · cost {money(report.profit.costOfSales)}</em></div>
            <div><span>Running expenses</span><strong>{money(report.profit.operatingExpenses)}</strong><em>All paid out {money(report.cashBook.expensesAll)}</em></div>
            <div className={report.profit.netProfit >= 0 ? "lx-kpi-good" : "lx-kpi-bad"}><span>Net profit</span><strong>{money(report.profit.netProfit)}</strong><em>after running expenses</em></div>
          </div>

          <div className="lx-period-grid">
            <section className="lx-card">
              <div className="lx-card-head"><div><div className="lx-card-title">How customers paid</div><div className="lx-card-sub">{label}</div></div></div>
              <div className="lx-paysplit">
                {([["Cash", report.sales.cash, report.sales.cashBills, "cash"], ["Card", report.sales.card, report.sales.cardBills, "card"], ["Transfer / QR", report.sales.transfer, report.sales.transferBills, "qr"]] as const).map(([name, value, bills, tone]) => (
                  <div key={name}>
                    <div className="row"><span>{name} <em>{bills} bills</em></span><strong>{money(value)}</strong></div>
                    <div className="track"><i className={tone} style={{ width: `${report.sales.netSales ? (value / report.sales.netSales) * 100 : 0}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="lx-book-totals" style={{ marginTop: "1rem" }}>
                <span>Shifts closed<b>{report.shifts.count}</b></span>
                <span>Drawer over<b>{money(report.shifts.over)}</b></span>
                <span>Drawer short<b>{money(Math.abs(report.shifts.short))}</b></span>
                <span>Waiting to be banked<b>{money(report.cashBook.waiting)}</b></span>
              </div>
            </section>

            <section className="lx-card">
              <div className="lx-card-head"><div><div className="lx-card-title">Sales by {report.period.grouping === "HOUR" ? "hour" : report.period.grouping === "DAY" ? "day" : "month"}</div><div className="lx-card-sub">Net sales, with gross profit underneath</div></div></div>
              {trend.length === 0 ? <div className="lx-empty">No sales in this period.</div> : (
                <div className="lx-trend">
                  {trend.map((row) => (
                    <div key={row.key} className="lx-trend-row" title={`${row.bills} bills · profit ${money(row.grossProfit)}`}>
                      <span>{trendLabel(row.key, report.period.grouping)}</span>
                      <div className="bars">
                        <i style={{ width: `${(row.netSales / maxTrend) * 100}%` }} />
                        <i className="profit" style={{ width: `${(Math.max(row.grossProfit, 0) / maxTrend) * 100}%` }} />
                      </div>
                      <strong>{row.netSales ? money(row.netSales) : "—"}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="lx-period-grid">
            <section className="lx-card lx-log-card">
              <div className="lx-card-head"><div><div className="lx-card-title">Best-selling products</div><div className="lx-card-sub">Top 10 by sales</div></div></div>
              <div className="data-table-wrap"><table className="data-table">
                <thead><tr><th>Product</th><th style={{ textAlign: "right" }}>Units</th><th style={{ textAlign: "right" }}>Sales</th><th style={{ textAlign: "right" }}>Profit</th></tr></thead>
                <tbody>
                  {report.byProduct.slice(0, 10).map((row) => (
                    <tr key={row.name + row.detail}><td><strong>{row.name}</strong><div className="td-muted">{row.detail || row.category}</div></td><td style={{ textAlign: "right" }}>{row.units}</td><td style={{ textAlign: "right" }}>{money(row.amount)}</td><td style={{ textAlign: "right" }}>{money(row.profit)}</td></tr>
                  ))}
                  {report.byProduct.length === 0 && <tr><td colSpan={4} className="bm-table-empty">Nothing sold.</td></tr>}
                </tbody>
              </table></div>
            </section>

            <section className="lx-card lx-log-card">
              <div className="lx-card-head"><div><div className="lx-card-title">Sales by staff</div><div className="lx-card-sub">Who sold what</div></div></div>
              <div className="data-table-wrap"><table className="data-table">
                <thead><tr><th>Staff</th><th style={{ textAlign: "right" }}>Bills</th><th style={{ textAlign: "right" }}>Cash</th><th style={{ textAlign: "right" }}>Card / QR</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
                <tbody>
                  {report.byStaff.map((row) => (
                    <tr key={row.name}><td><strong>{row.name}</strong></td><td style={{ textAlign: "right" }}>{row.bills}</td><td style={{ textAlign: "right" }}>{money(row.cash)}</td><td style={{ textAlign: "right" }}>{money(row.card + row.transfer)}</td><td style={{ textAlign: "right" }}>{money(row.total)}</td></tr>
                  ))}
                  {report.byStaff.length === 0 && <tr><td colSpan={5} className="bm-table-empty">No sales.</td></tr>}
                </tbody>
              </table></div>
              <div className="lx-card-head" style={{ marginTop: "0.6rem" }}><div><div className="lx-card-title">Expenses paid out</div><div className="lx-card-sub">{money(report.cashBook.expensesAll)} in total</div></div></div>
              <div className="lx-book-totals" style={{ padding: "0 0.4rem 0.6rem" }}>
                {report.cashBook.expenses.map((row) => <span key={row.category}>{row.label} ({row.count})<b>{money(row.amount)}</b></span>)}
                {report.cashBook.expenses.length === 0 && <span>No expenses recorded</span>}
              </div>
            </section>
          </div>

          <div className="lx-period-grid">
            <section className="lx-card">
              <div className="lx-card-head"><div><div className="lx-card-title">Discounts given</div><div className="lx-card-sub">{report.discounts.bills} discounted bill(s) · {money(report.discounts.amount)}</div></div></div>
              <div className="lx-book-totals">
                <span>Percentage ({report.discounts.percent.bills})<b>{money(report.discounts.percent.amount)}</b></span>
                <span>Fixed amount ({report.discounts.fixed.bills})<b>{money(report.discounts.fixed.amount)}</b></span>
                {report.discounts.byStaff.map((row) => <span key={row.name}>By {row.name} ({row.bills})<b>{money(row.amount)}</b></span>)}
              </div>
              {report.adjustments.length > 0 && (
                <div className="data-table-wrap" style={{ marginTop: "0.9rem" }}><table className="data-table">
                  <thead><tr><th>Bill</th><th>Sold by</th><th>Member</th><th style={{ textAlign: "right" }}>Discount</th><th style={{ textAlign: "right" }}>Points</th><th style={{ textAlign: "right" }}>Paid</th></tr></thead>
                  <tbody>{report.adjustments.slice(-12).reverse().map((row) => (
                    <tr key={row.billNo}>
                      <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{new Date(row.time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}<div>{row.billNo.slice(-9)}</div></td>
                      <td>{row.cashier}</td>
                      <td>{row.member ?? "Walk-in"}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{row.discountType ? <><span className="lx-amount-out">−{money(row.discountAmount)}</span><div className="td-muted">{discountText(row)}</div></> : "—"}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{row.pointsRedeemed ? <><span className="lx-amount-out">{row.pointsRedeemed}</span><div className="td-muted">−{money(row.pointsValue)}</div></> : "—"}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money(row.total)}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
              {report.adjustments.length > 12 && <div className="lx-card-sub" style={{ marginTop: "0.5rem" }}>Latest 12 shown. The printed report lists all {report.adjustments.length}.</div>}
            </section>

            <section className="lx-card">
              <div className="lx-card-head"><div><div className="lx-card-title">Loyalty points</div><div className="lx-card-sub">{report.loyalty.memberBills} member bill(s) · {report.loyalty.newMembers} new member(s)</div></div></div>
              <div className="lx-book-totals">
                <span>Points earned<b>{report.loyalty.pointsEarned.toLocaleString()}</b></span>
                <span>Points used ({report.loyalty.redeemBills} bills)<b>{report.loyalty.pointsRedeemed.toLocaleString()} · {money(report.loyalty.pointsValue)}</b></span>
                <span>Points members hold now<b>{report.loyalty.owed.points.toLocaleString()} · {money(report.loyalty.owed.value)}</b></span>
              </div>
              {report.loyalty.byMember.length > 0 && (
                <div className="data-table-wrap" style={{ marginTop: "0.9rem" }}><table className="data-table">
                  <thead><tr><th>Member</th><th style={{ textAlign: "right" }}>Bills</th><th style={{ textAlign: "right" }}>Spent</th><th style={{ textAlign: "right" }}>Earned</th><th style={{ textAlign: "right" }}>Used</th></tr></thead>
                  <tbody>{report.loyalty.byMember.slice(0, 10).map((row) => (
                    <tr key={row.name}><td><strong>{row.name}</strong></td><td style={{ textAlign: "right" }}>{row.bills}</td><td style={{ textAlign: "right" }}>{money(row.spent)}</td><td style={{ textAlign: "right" }}>{row.earned}</td><td style={{ textAlign: "right" }}>{row.redeemed || "—"}</td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </section>
          </div>
        </div>
      )}
      {!report && !error && <div className="lx-empty">Loading report…</div>}

      {preview && report && (
        <div className="bm-modal-backdrop" onClick={() => setPreview(false)}>
          <div className="lx-report-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Report preview">
            <div className="lx-report-head">
              <div><strong>{PERIOD_TITLES[kind]} · {label}</strong><span>{money(report.sales.netSales)} net sales · {money(report.profit.netProfit)} net profit</span></div>
              <div className="lx-report-actions">
                <button type="button" className="btn-accent" onClick={() => printPeriodReport(report, kind)}><IconPrinter size={16} /> Print A4 / Save PDF</button>
                <button type="button" className="btn-outline" onClick={() => setPreview(false)}>Close</button>
              </div>
            </div>
            <iframe className="lx-report-frame" title="Report preview" srcDoc={buildPeriodReportHtml(report, kind)} />
          </div>
        </div>
      )}
    </div>
  );
}
