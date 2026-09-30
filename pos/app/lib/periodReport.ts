import { SHOP } from "./shop";
import { escapeHtml as esc, printA4 } from "./print";
import { REPORT_CSS } from "./dayEndReport";
import { discountText } from "./bookPrint";

/** Mirrors /api/pos/reports/period. */
export type PeriodReport = {
  period: { from: string; to: string; days: number; grouping: "HOUR" | "DAY" | "MONTH" };
  /** The branch reported on; null = all branches together (older servers leave it out). */
  branch?: { id: number; name: string; code: string } | null;
  sales: {
    bills: number; units: number; grossSales: number; emptyDeduction: number; emptiesReturned: number; discounts: number; pointsValue: number;
    netSales: number; byType?: { hardLiquor: { units: number; amount: number }; other: { units: number; amount: number } }; refunds?: number; netAfterReturns?: number; averageBill: number; cash: number; card: number; transfer: number; cashBills: number; cardBills: number; transferBills: number; memberBills: number;
  };
  profit: { costOfSales: number; grossProfit: number; margin: number; operatingExpenses: number; damageLoss?: number; netProfit: number };
  /** Returns & damages in the period (older servers don't send it). */
  returns?: {
    refunds: number; refundBills: number; refundUnits: number; refundsCash: number; refundsWallet: number; returnedToShelf: number; returnedDamaged: number;
    exchanged: number; storeDamaged: number; toSupplier: number; writtenOff: number; restored: number; damageLoss: number; damagedNow: number; damagedValueNow: number;
  };
  trend: Array<{ key: string; bills: number; netSales: number; cash: number; card: number; transfer: number; grossProfit: number; expenses: number }>;
  byStaff: Array<{ name: string; bills: number; cash: number; card: number; transfer: number; total: number }>;
  byProduct: Array<{ name: string; detail: string; category: string; units: number; amount: number; cost: number; profit: number }>;
  byCategory: Array<{ name: string; units: number; amount: number; cost: number; profit: number }>;
  cashBook: {
    expensesAll: number;
    expenses: Array<{ category: string; label: string; amount: number; count: number; operating: boolean }>;
    otherIncome: Array<{ category: string; label: string; amount: number; count: number }>;
    banked: number; waiting: number;
  };
  shifts: {
    count: number; over: number; short: number; net: number; withDifference: number;
    /** Cash drawer opened without a sale, per staff member. */
    noSaleOpens?: { count: number; byStaff: Array<{ name: string; count: number }> };
    rows: Array<{ shiftNo: string; openedAt: string; closedAt: string | null; openedBy: string; closedBy: string; bills: number; netSales: number; cashDifference: number; differenceReason: string | null; cardDifference: number | null; cashBanked: number }>;
  };
  stock: { freeIssues?: { grns: number; units: number; value: number }; rows: Array<{ name: string; detail: string; received: number; sold: number; customerReturns?: number; damaged?: number; transferIn?: number; transferOut?: number; adjusted: number; collected: number; returned: number; receivedValue: number; onHand: number }>; stockValueNow: number };
  discounts: {
    bills: number; amount: number; percent: { bills: number; amount: number }; fixed: { bills: number; amount: number };
    byStaff: Array<{ name: string; bills: number; amount: number }>;
  };
  loyalty: {
    newMembers: number; memberBills: number; pointsEarned: number; pointsRedeemed: number; pointsValue: number; redeemBills: number;
    byMember: Array<{ name: string; bills: number; spent: number; earned: number; redeemed: number; value: number }>;
    owed: { points: number; members: number; value: number; pointValue: number };
    wallet?: { kept: number; keptBills: number; used: number; usedBills: number; heldNow: number; membersHolding: number };
  };
  adjustments: Array<{
    billNo: string; time: string; cashier: string; member: string | null; billBefore: number;
    discountType: string | null; discountValue: number; discountAmount: number; pointsRedeemed: number; pointsValue: number; total: number;
  }>;
  generatedAt: string;
};

export type PeriodKind = "day" | "week" | "month" | "year" | "custom";
export const PERIOD_TITLES: Record<PeriodKind, string> = { day: "Daily Report", week: "Weekly Report", month: "Monthly Report", year: "Yearly Report", custom: "Sales Report" };

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parse = (text: string) => new Date(`${text}T00:00:00`);

/** The date range for a period containing `anchor`. Weeks run Monday to Sunday. */
export function periodRange(kind: Exclude<PeriodKind, "custom">, anchor: Date) {
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (kind === "day") return { from: iso(a), to: iso(a) };
  if (kind === "week") {
    const monday = new Date(a);
    monday.setDate(a.getDate() - ((a.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: iso(monday), to: iso(sunday) };
  }
  if (kind === "month") return { from: iso(new Date(a.getFullYear(), a.getMonth(), 1)), to: iso(new Date(a.getFullYear(), a.getMonth() + 1, 0)) };
  return { from: iso(new Date(a.getFullYear(), 0, 1)), to: iso(new Date(a.getFullYear(), 11, 31)) };
}

/** Moves the anchor one period back (−1) or forward (+1). */
export function stepAnchor(kind: Exclude<PeriodKind, "custom">, anchor: Date, step: -1 | 1) {
  const next = new Date(anchor);
  if (kind === "day") next.setDate(next.getDate() + step);
  else if (kind === "week") next.setDate(next.getDate() + 7 * step);
  else if (kind === "month") next.setMonth(next.getMonth() + step, 1);
  else next.setFullYear(next.getFullYear() + step);
  return next;
}

export function periodLabel(kind: PeriodKind, from: string, to: string) {
  const f = parse(from);
  const t = parse(to);
  if (kind === "day") return f.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (kind === "month") return f.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  if (kind === "year") return String(f.getFullYear());
  const sameYear = f.getFullYear() === t.getFullYear();
  const sameMonth = sameYear && f.getMonth() === t.getMonth();
  const left = f.toLocaleDateString("en-GB", { day: "numeric", ...(sameMonth ? {} : { month: "short" }), ...(sameYear ? {} : { year: "numeric" }) });
  return `${left} – ${t.toLocaleDateString("en-GB", { day: "numeric", month: sameMonth ? "long" : "short", year: "numeric" })}`;
}

/** Row label for the breakdown: an hour, a day or a month. */
export function trendLabel(key: string, grouping: PeriodReport["period"]["grouping"], short = false) {
  if (grouping === "HOUR") return key;
  if (grouping === "DAY") return parse(key).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return parse(`${key}-01`).toLocaleDateString("en-GB", { month: short ? "short" : "long", year: "numeric" });
}

export function periodFileName(kind: PeriodKind, from: string, to: string) {
  if (kind === "day") return `Daily-Report_${from}`;
  if (kind === "week") return `Weekly-Report_${from}_to_${to}`;
  if (kind === "month") return `Monthly-Report_${from.slice(0, 7)}`;
  if (kind === "year") return `Yearly-Report_${from.slice(0, 4)}`;
  return `Sales-Report_${from}_to_${to}`;
}

const amt = (value: number) => value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs = (value: number) => `Rs. ${amt(value)}`;
const signed = (value: number) => (Math.abs(value) < 0.005 ? "0.00" : `${value > 0 ? "+" : "−"}${amt(Math.abs(value))}`);
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : "—");
const dateTime = (value: string | null) => (value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

const EXTRA_CSS = `
  .bar { display: inline-block; height: 7px; border-radius: 2px; background: #16161a; vertical-align: middle; }
  .bar.soft { background: #c9c9d1; }
  td.barcell { width: 16%; }
  td.nowrap { white-space: nowrap; }
  tr.idle td { color: #a5a5ad; }
  section + .cols { margin-top: 18px; }
  .kpi.profit b { color: #17803d; } .kpi.loss b { color: #b42318; }
  .note { font-size: 8pt; color: #6b6b73; margin-top: 4px; }
`;

/** A4 period report: sales, profit and loss, payments, breakdown, staff, products, expenses, shifts, stock. */
export function buildPeriodReportHtml(report: PeriodReport, kind: PeriodKind) {
  const { period, sales, profit, cashBook, shifts, stock, loyalty, discounts } = report;
  const title = PERIOD_TITLES[kind];
  const label = periodLabel(kind, period.from, period.to);
  const trendRows = period.grouping === "HOUR" ? report.trend.filter((row) => row.bills || row.expenses) : report.trend;
  const maxTrend = Math.max(1, ...trendRows.map((row) => row.netSales));
  const otherIncome = cashBook.otherIncome.reduce((sum, row) => sum + row.amount, 0);
  const otherIncomeCounted = cashBook.otherIncome.filter((row) => row.category !== "OWNER_CASH_IN").reduce((sum, row) => sum + row.amount, 0);
  const profitTone = profit.netProfit >= 0 ? "profit" : "loss";
  const bucketName = period.grouping === "HOUR" ? "Hour" : period.grouping === "DAY" ? "Day" : "Month";
  const stockReturnCols = stock.rows.some((row) => row.customerReturns || row.damaged);
  const stockTransferCols = stock.rows.some((row) => row.transferIn || row.transferOut);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(periodFileName(kind, period.from, period.to))}</title><style>${REPORT_CSS}${EXTRA_CSS}</style></head><body><div class="sheet">

  <div class="top">
    <div>
      <div class="shop">${esc(SHOP.name)}</div>
      ${SHOP.tagline ? `<div class="tag">${esc(SHOP.tagline)}</div>` : ""}
      <div class="addr">${esc(SHOP.address)}${SHOP.phone ? ` · Tel ${esc(SHOP.phone)}` : ""}</div>
    </div>
    <div class="doc">
      <h1>${esc(title)}</h1>
      <div class="sub">${esc(label)}${report.branch !== undefined ? ` · ${esc(report.branch?.name ?? "All branches")}` : ""}</div>
      <div class="stamp closed">${period.days} DAY${period.days === 1 ? "" : "S"} · ${shifts.count} SHIFT${shifts.count === 1 ? "" : "S"}</div>
    </div>
  </div>

  <div class="facts">
    <div><span>From</span><b>${parse(period.from).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</b></div>
    <div><span>To</span><b>${parse(period.to).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</b></div>
    <div><span>Bills</span><b>${sales.bills.toLocaleString()} · avg ${rs(sales.averageBill)}</b></div>
    <div><span>Prepared</span><b>${dateTime(report.generatedAt)}</b></div>
  </div>

  <div class="kpis">
    <div class="kpi dark"><span>Net sales</span><b>${rs(sales.netSales)}</b><em>${sales.bills} bills · ${sales.units} units</em></div>
    <div class="kpi"><span>Gross profit</span><b>${rs(profit.grossProfit)}</b><em>${profit.margin}% margin</em></div>
    <div class="kpi"><span>Running expenses</span><b>${rs(profit.operatingExpenses)}</b><em>All paid out ${rs(cashBook.expensesAll)}</em></div>
    <div class="kpi ${profitTone}"><span>Net profit</span><b>${rs(profit.netProfit)}</b><em>After running expenses</em></div>
  </div>

  <div class="cols">
    <section class="keep">
      <h2>Sales summary</h2>
      <table class="ledger">
        <tr><td>Gross sales</td><td class="r">${amt(sales.grossSales)}</td></tr>
        ${sales.emptyDeduction ? `<tr><td>Less: empty bottles returned (${sales.emptiesReturned})</td><td class="r minus">−${amt(sales.emptyDeduction)}</td></tr>` : ""}
        ${sales.discounts ? `<tr><td>Less: discounts</td><td class="r minus">−${amt(sales.discounts)}</td></tr>` : ""}
        ${sales.pointsValue ? `<tr><td>Less: loyalty points redeemed</td><td class="r minus">−${amt(sales.pointsValue)}</td></tr>` : ""}
        <tr class="total"><td>Net sales</td><td class="r">${amt(sales.netSales)}</td></tr>
        <tr><td>Cash (${sales.cashBills} bills)</td><td class="r">${amt(sales.cash)}</td></tr>
        <tr><td>Card (${sales.cardBills} bills)</td><td class="r">${amt(sales.card)}</td></tr>
        <tr><td>Bank transfer / QR (${sales.transferBills} bills)</td><td class="r">${amt(sales.transfer)}</td></tr>
        <tr><td>Loyalty member bills</td><td class="r">${sales.memberBills}</td></tr>
        ${sales.byType ? `<tr><td>Hard liquor (${sales.byType.hardLiquor.units} bottles)</td><td class="r">${amt(sales.byType.hardLiquor.amount)}</td></tr>
        <tr><td>Beer, wine &amp; others (${sales.byType.other.units})</td><td class="r">${amt(sales.byType.other.amount)}</td></tr>` : ""}
        ${sales.refunds ? `<tr><td>Less: refunds for returned bottles</td><td class="r minus">−${amt(sales.refunds)}</td></tr>
        <tr class="total"><td>Net sales after returns</td><td class="r">${amt(sales.netAfterReturns ?? sales.netSales)}</td></tr>` : ""}
      </table>
    </section>
    <section class="keep">
      <h2>Profit &amp; loss</h2>
      <table class="ledger">
        <tr><td>Net sales</td><td class="r">${amt(sales.netSales)}</td></tr>
        ${sales.refunds ? `<tr><td>Less: refunds for returned bottles</td><td class="r minus">−${amt(sales.refunds)}</td></tr>` : ""}
        <tr><td>Less: cost of bottles sold${sales.refunds ? " (less bottles back on the shelf)" : ""}</td><td class="r minus">−${amt(profit.costOfSales)}</td></tr>
        <tr class="total"><td>Gross profit (${profit.margin}%)</td><td class="r">${amt(profit.grossProfit)}</td></tr>
        <tr><td>Less: running expenses</td><td class="r minus">−${amt(profit.operatingExpenses)}</td></tr>
        ${profit.damageLoss ? `<tr><td>Less: damaged bottles (at cost)</td><td class="r minus">−${amt(profit.damageLoss)}</td></tr>` : ""}
        ${otherIncomeCounted ? `<tr><td>Add: other income</td><td class="r plus">+${amt(otherIncomeCounted)}</td></tr>` : ""}
        <tr class="total"><td>Net profit</td><td class="r ${profit.netProfit < 0 ? "minus" : ""}">${amt(profit.netProfit)}</td></tr>
      </table>
      <div class="note">Cost of bottles uses each product's current cost price. Stock purchases and staff advances are not running expenses.</div>
    </section>
  </div>

  <section>
    <h2>Breakdown by ${bucketName.toLowerCase()} <small>${trendRows.length} row(s)</small></h2>
    <table>
      <thead><tr><th>${bucketName}</th><th class="r">Bills</th><th class="r">Net sales</th><th></th><th class="r">Cash</th><th class="r">Card</th><th class="r">Transfer / QR</th><th class="r">Gross profit</th><th class="r">Expenses</th></tr></thead>
      ${trendRows.map((row) => {
        const d = (value: number) => (value ? amt(value) : "—");
        return `<tr class="${row.bills || row.expenses ? "" : "idle"}"><td class="nowrap">${esc(trendLabel(row.key, period.grouping, true))}</td><td class="r">${row.bills || "—"}</td><td class="r strong">${d(row.netSales)}</td>
        <td class="barcell"><span class="bar" style="width:${Math.round((row.netSales / maxTrend) * 100)}%"></span></td>
        <td class="r">${d(row.cash)}</td><td class="r">${d(row.card)}</td><td class="r">${d(row.transfer)}</td><td class="r">${d(row.grossProfit)}</td><td class="r">${d(row.expenses)}</td></tr>`;
      }).join("") || `<tr><td colspan="9" class="empty">No sales in this period</td></tr>`}
      <tr class="total"><td>Total</td><td class="r">${sales.bills}</td><td class="r">${amt(sales.netSales)}</td><td></td><td class="r">${amt(sales.cash)}</td><td class="r">${amt(sales.card)}</td><td class="r">${amt(sales.transfer)}</td><td class="r">${amt(profit.grossProfit)}</td><td class="r">${amt(profit.operatingExpenses)}</td></tr>
    </table>
  </section>

  <section class="keep">
    <h2>Sales by staff</h2>
    <table>
      <thead><tr><th>Staff member</th><th class="r">Bills</th><th class="r">Cash</th><th class="r">Card</th><th class="r">Transfer / QR</th><th class="r">Total</th><th class="r">Share</th></tr></thead>
      ${report.byStaff.map((row) => `<tr><td>${esc(row.name)}</td><td class="r">${row.bills}</td><td class="r">${amt(row.cash)}</td><td class="r">${amt(row.card)}</td><td class="r">${amt(row.transfer)}</td><td class="r strong">${amt(row.total)}</td><td class="r">${pct(row.total, sales.netSales)}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No sales</td></tr>`}
    </table>
  </section>

  <section class="keep">
    <h2>Sales by category</h2>
    <table>
      <thead><tr><th>Category</th><th class="r">Units</th><th class="r">Sales</th><th class="r">Cost</th><th class="r">Profit</th><th class="r">Share</th></tr></thead>
      ${report.byCategory.map((row) => `<tr><td>${esc(row.name)}</td><td class="r">${row.units}</td><td class="r">${amt(row.amount)}</td><td class="r">${amt(row.cost)}</td><td class="r strong">${amt(row.profit)}</td><td class="r">${pct(row.amount, sales.netSales)}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">No sales</td></tr>`}
    </table>
  </section>

  <section>
    <h2>Products sold <small>${report.byProduct.length} product(s), best sellers first</small></h2>
    <table>
      <thead><tr><th>Product</th><th>Category</th><th class="r">Units</th><th class="r">Sales</th><th class="r">Cost</th><th class="r">Profit</th></tr></thead>
      ${report.byProduct.map((row) => `<tr><td>${esc(row.name)}${row.detail ? `<div class="muted">${esc(row.detail)}</div>` : ""}</td><td>${esc(row.category)}</td><td class="r">${row.units}</td><td class="r">${amt(row.amount)}</td><td class="r">${amt(row.cost)}</td><td class="r strong">${amt(row.profit)}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">Nothing sold</td></tr>`}
    </table>
  </section>

  <div class="cols">
    <section class="keep">
      <h2>Expenses paid out</h2>
      <table>
        <thead><tr><th>Type</th><th class="r">Entries</th><th class="r">Amount</th></tr></thead>
        ${cashBook.expenses.map((row) => `<tr><td>${esc(row.label)}${row.operating ? "" : `<div class="muted">Not a running expense</div>`}</td><td class="r">${row.count}</td><td class="r">${amt(row.amount)}</td></tr>`).join("") || `<tr><td colspan="3" class="empty">No expenses</td></tr>`}
        ${cashBook.expenses.length ? `<tr class="total"><td>Total paid out</td><td class="r">${cashBook.expenses.reduce((s, r) => s + r.count, 0)}</td><td class="r">${amt(cashBook.expensesAll)}</td></tr>` : ""}
      </table>
    </section>
    <section class="keep">
      <h2>Money in &amp; banking</h2>
      <table class="ledger">
        ${cashBook.otherIncome.map((row) => `<tr><td>${esc(row.label)} (${row.count})</td><td class="r">${amt(row.amount)}</td></tr>`).join("")}
        ${cashBook.otherIncome.length ? `<tr class="total"><td>Other money in</td><td class="r">${amt(otherIncome)}</td></tr>` : `<tr><td class="empty" colspan="2">No other money in</td></tr>`}
        <tr><td>Shift takings banked</td><td class="r">${amt(cashBook.banked)}</td></tr>
        <tr><td>Shift takings waiting to be banked</td><td class="r ${cashBook.waiting ? "flag" : ""}">${amt(cashBook.waiting)}</td></tr>
      </table>
    </section>
  </div>

  <section>
    <h2>Shifts &amp; cash drawer <small>${shifts.count} closed · ${shifts.withDifference} with a difference${shifts.noSaleOpens ? ` · drawer opened ${shifts.noSaleOpens.count} time${shifts.noSaleOpens.count === 1 ? "" : "s"} without a sale${shifts.noSaleOpens.byStaff.length ? ` (${shifts.noSaleOpens.byStaff.map((row) => `${esc(row.name)} ${row.count}`).join(", ")})` : ""}` : ""}</small></h2>
    <table>
      <thead><tr><th>Shift</th><th>Opened</th><th>Closed</th><th>Closed by</th><th class="r">Bills</th><th class="r">Net sales</th><th class="r">Drawer</th><th class="r">Banked</th></tr></thead>
      ${shifts.rows.map((row) => `<tr><td>${esc(row.shiftNo)}</td><td>${dateTime(row.openedAt)}</td><td>${dateTime(row.closedAt)}</td><td>${esc(row.closedBy)}</td><td class="r">${row.bills}</td><td class="r">${amt(row.netSales)}</td>
        <td class="r ${Math.abs(row.cashDifference) > 0.004 ? "flag" : ""}">${Math.abs(row.cashDifference) < 0.005 ? "Balanced" : signed(row.cashDifference)}${row.differenceReason ? `<div class="muted">${esc(row.differenceReason)}</div>` : ""}</td><td class="r">${amt(row.cashBanked)}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">No shifts closed in this period</td></tr>`}
      ${shifts.count ? `<tr class="total"><td colspan="6">Over ${amt(shifts.over)} · Short ${amt(Math.abs(shifts.short))}</td><td class="r">${signed(shifts.net)}</td><td class="r">${amt(shifts.rows.reduce((s, r) => s + r.cashBanked, 0))}</td></tr>` : ""}
    </table>
  </section>

  ${report.returns && (report.returns.refunds || report.returns.exchanged || report.returns.storeDamaged || report.returns.damagedNow || report.returns.toSupplier || report.returns.writtenOff) ? `
  <div class="cols">
    <section class="keep">
      <h2>Returns &amp; refunds</h2>
      <table class="ledger">
        <tr><td>Refunds (${report.returns.refundBills}) · ${report.returns.refundUnits} bottle(s)</td><td class="r">${amt(report.returns.refunds)}</td></tr>
        <tr><td>Paid back in cash</td><td class="r">${amt(report.returns.refundsCash)}</td></tr>
        <tr><td>Paid into member wallets</td><td class="r">${amt(report.returns.refundsWallet)}</td></tr>
        <tr><td>Bottles back on the shelf</td><td class="r">${report.returns.returnedToShelf}</td></tr>
        <tr><td>Returned bottles kept aside as damaged</td><td class="r">${report.returns.returnedDamaged}</td></tr>
      </table>
    </section>
    <section class="keep">
      <h2>Damaged stock</h2>
      <table class="ledger">
        <tr><td>Damaged bottles exchanged for new</td><td class="r">${report.returns.exchanged}</td></tr>
        <tr><td>Found damaged in store</td><td class="r">${report.returns.storeDamaged}</td></tr>
        <tr><td>Sent back to supplier</td><td class="r">${report.returns.toSupplier}</td></tr>
        <tr><td>Thrown away (written off)</td><td class="r">${report.returns.writtenOff}</td></tr>
        ${report.returns.restored ? `<tr><td>Put back on the shelf</td><td class="r">${report.returns.restored}</td></tr>` : ""}
        <tr class="total"><td>Damage loss at cost</td><td class="r">${amt(report.returns.damageLoss)}</td></tr>
        <tr><td>Damaged stock kept aside now</td><td class="r">${report.returns.damagedNow} · ${amt(report.returns.damagedValueNow)}</td></tr>
      </table>
    </section>
  </div>` : ""}

  <section>
    <h2>Stock movement <small>stock on hand now worth ${rs(stock.stockValueNow)} at cost${stock.freeIssues?.units ? ` · ${stock.freeIssues.units} free-issue bottle(s) received, worth ${rs(stock.freeIssues.value)}` : ""}</small></h2>
    <table>
      <thead><tr><th>Product</th><th class="r">Received</th><th class="r">Received value</th><th class="r">Sold</th>${stockTransferCols ? `<th class="r">From branch</th><th class="r">To branch</th>` : ""}${stockReturnCols ? `<th class="r">Returned</th><th class="r">Damaged</th>` : ""}<th class="r">Adjusted</th><th class="r">Empties in</th><th class="r">Empties out</th><th class="r">On hand now</th></tr></thead>
      ${stock.rows.map((row) => `<tr><td>${esc(row.name)}${row.detail ? `<div class="muted">${esc(row.detail)}</div>` : ""}</td><td class="r">${row.received || "—"}</td><td class="r">${row.receivedValue ? amt(row.receivedValue) : "—"}</td><td class="r">${row.sold || "—"}</td>${stockTransferCols ? `<td class="r">${row.transferIn ? `+${row.transferIn}` : "—"}</td><td class="r">${row.transferOut ? `−${row.transferOut}` : "—"}</td>` : ""}${stockReturnCols ? `<td class="r">${row.customerReturns ? `+${row.customerReturns}` : "—"}</td><td class="r">${row.damaged ? `−${row.damaged}` : "—"}</td>` : ""}<td class="r">${row.adjusted ? (row.adjusted > 0 ? `+${row.adjusted}` : row.adjusted) : "—"}</td><td class="r">${row.collected || "—"}</td><td class="r">${row.returned || "—"}</td><td class="r strong">${row.onHand}</td></tr>`).join("") || `<tr><td colspan="10" class="empty">No stock movements</td></tr>`}
    </table>
  </section>

  <div class="cols">
    <section class="keep">
      <h2>Discounts given</h2>
      <table class="ledger">
        <tr><td>Discounted bills</td><td class="r">${discounts.bills}</td></tr>
        <tr><td>Percentage discounts (${discounts.percent.bills})</td><td class="r">${amt(discounts.percent.amount)}</td></tr>
        <tr><td>Fixed-amount discounts (${discounts.fixed.bills})</td><td class="r">${amt(discounts.fixed.amount)}</td></tr>
        <tr class="total"><td>Total discounts</td><td class="r">${amt(discounts.amount)}</td></tr>
        ${discounts.byStaff.map((row) => `<tr><td>Given by ${esc(row.name)} (${row.bills})</td><td class="r">${amt(row.amount)}</td></tr>`).join("")}
      </table>
    </section>
    <section class="keep">
      <h2>Loyalty points</h2>
      <table class="ledger">
        <tr><td>Member bills</td><td class="r">${loyalty.memberBills}</td></tr>
        <tr><td>New members joined</td><td class="r">${loyalty.newMembers}</td></tr>
        <tr><td>Points earned</td><td class="r">${loyalty.pointsEarned.toLocaleString()}</td></tr>
        <tr><td>Points used on ${loyalty.redeemBills} bill(s)</td><td class="r">${loyalty.pointsRedeemed.toLocaleString()} · ${amt(loyalty.pointsValue)}</td></tr>
        <tr class="total"><td>Points members hold now (${loyalty.owed.members})</td><td class="r">${loyalty.owed.points.toLocaleString()} · ${amt(loyalty.owed.value)}</td></tr>
      </table>
      ${loyalty.wallet ? `<table class="ledger" style="margin-top:6px">
        <tr><td>Change kept in customer wallets (${loyalty.wallet.keptBills} bill(s))</td><td class="r">${amt(loyalty.wallet.kept)}</td></tr>
        <tr><td>Paid from customer wallets (${loyalty.wallet.usedBills} bill(s))</td><td class="r">${amt(loyalty.wallet.used)}</td></tr>
        <tr class="total"><td>Wallet money members hold now (${loyalty.wallet.membersHolding})</td><td class="r">${amt(loyalty.wallet.heldNow)}</td></tr>
      </table>` : ""}
      <div class="note">Wallet money held now is cash the shop keeps for members and owes back as future payments. Points held now are future discounts the shop owes, valued at Rs. ${loyalty.owed.pointValue} per point.</div>
    </section>
  </div>

  ${report.adjustments.length ? `
  <section>
    <h2>Discount &amp; points register <small>every bill with money taken off</small></h2>
    <table>
      <thead><tr><th>Date</th><th>Bill no</th><th>Sold by</th><th>Member</th><th class="r">Bill before</th><th class="r">Discount</th><th class="r">Points</th><th class="r">Paid</th></tr></thead>
      ${report.adjustments.map((row) => `<tr><td class="nowrap">${dateTime(row.time)}</td><td>${esc(row.billNo)}</td><td>${esc(row.cashier)}</td><td>${esc(row.member ?? "Walk-in")}</td><td class="r">${amt(row.billBefore)}</td>
        <td class="r">${row.discountType ? `<span class="minus">−${amt(row.discountAmount)}</span><div class="muted">${esc(discountText(row))}</div>` : "—"}</td>
        <td class="r">${row.pointsRedeemed ? `${row.pointsRedeemed}<div class="muted">−${amt(row.pointsValue)}</div>` : "—"}</td><td class="r">${amt(row.total)}</td></tr>`).join("")}
      <tr class="total"><td colspan="5">Total taken off</td><td class="r">${amt(discounts.amount)}</td><td class="r">${amt(loyalty.pointsValue)}</td><td></td></tr>
    </table>
  </section>` : ""}

  ${loyalty.byMember.length ? `
  <section>
    <h2>Members <small>${loyalty.byMember.length} member(s) bought in this period</small></h2>
    <table>
      <thead><tr><th>Member</th><th class="r">Bills</th><th class="r">Spent</th><th class="r">Points earned</th><th class="r">Points used</th><th class="r">Value used</th></tr></thead>
      ${loyalty.byMember.map((row) => `<tr><td>${esc(row.name)}</td><td class="r">${row.bills}</td><td class="r">${amt(row.spent)}</td><td class="r">${row.earned}</td><td class="r">${row.redeemed || "—"}</td><td class="r">${row.value ? amt(row.value) : "—"}</td></tr>`).join("")}
    </table>
  </section>` : ""}

  <div class="sign">
    <div><b>Prepared by</b>Name &amp; date</div>
    <div><b>Checked by (manager)</b>Name &amp; date</div>
    <div><b>Owner</b>Signature</div>
  </div>
  <div class="foot"><span>${esc(SHOP.name)} · ${esc(title)} · ${esc(label)}</span><span>Printed ${dateTime(new Date().toISOString())}</span></div>
  </div></body></html>`;
}

export function printPeriodReport(report: PeriodReport, kind: PeriodKind) {
  printA4(buildPeriodReportHtml(report, kind), periodFileName(kind, report.period.from, report.period.to));
}
