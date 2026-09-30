import { SHOP } from "./shop";
import { escapeHtml as esc, printThermal, THERMAL_BASE_CSS } from "./print";

/** One bill with a discount, points spent or points earned. Rupee values are null in the cashier's blind view. */
export type AdjustmentRow = {
  billNo: string; time: string; cashier: string; member: string | null; billBefore: number | null;
  discountType: string | null; discountValue: number; discountAmount: number | null;
  pointsRedeemed: number; pointsValue: number | null; pointsEarned?: number; total: number | null;
};
export type ShiftLoyalty = {
  memberBills: number; discountBills: number; discountByStaff: Array<{ name: string; bills: number; amount: number | null }>;
  pointsEarned: number; redeemBills: number; rows: AdjustmentRow[];
};
/** How a discount was given, e.g. "10%" or "Rs. 200". */
export const discountText = (row: Pick<AdjustmentRow, "discountType" | "discountValue">) =>
  row.discountType === "PERCENT" ? `${row.discountValue}%` : row.discountType === "AMOUNT" ? `Rs. ${row.discountValue.toLocaleString("en-LK")}` : "";

/** A card or transfer payment recorded at the till. */
export type PaymentRow = { billNo: string; time: string; cashier: string; amount: number; reference: string | null; method: string };

/** Z report data as returned by /api/pos/shifts/:id/report (closed shifts include `close`). */
export type ShiftReport = {
  shift: { id: number; shiftNo: string; status: string; branch?: { id: number; code: string; name: string; address: string | null; phone: string | null }; openedAt: string; openedBy: string; openingFloat: number; countedAt: string | null; countedBy: string | null; closedAt: string | null; closedBy: string | null };
  sales: {
    bills: number; units: number; grossSales: number | null; emptyDeduction: number | null; emptiesReturned: number; discounts: number | null;
    pointsRedeemed: number; pointsValue: number | null; netSales: number | null; cashSales: number | null; cardSales: number | null;
    /** Bank transfer / QR (older reports lumped these into cardSales). */
    transferSales?: number | null;
    /** Bill parts paid from members' wallets, and change members kept in them. */
    walletUsed?: number | null;
    walletKept?: number | null;
    /** Paid back for returned bottles (cash + wallet), and net sales after that. */
    refunds?: number | null;
    netAfterReturns?: number | null;
    cardPayments?: PaymentRow[];
    transferPayments?: PaymentRow[];
    /** Discounts given and loyalty points moved in the shift (older reports don't have it). */
    loyalty?: ShiftLoyalty;
    byStaff: Array<{ name: string; bills: number; cash: number | null; card: number | null; transfer?: number | null; wallet?: number | null; total: number | null }>;
    byProduct: Array<{ name: string; units: number; amount: number | null }>;
    /** Hard liquor (ticked on the product) vs beer, wine and other drinks (older reports don't have it). */
    byType?: { hardLiquor: { units: number; amount: number | null }; other: { units: number; amount: number | null } };
    billList: Array<{ billNo: string; time: string; cashier: string; customer: string; payment: string; reference?: string | null; items: string; units: number; emptyDeduction: number | null; discount: number | null; total: number | null; offline?: boolean }>;
    /** Bills rung up while the till was offline and uploaded later. */
    offlineBills?: number;
  };
  cash: {
    openingFloat: number; cashSales: number | null; walletKept?: number | null; drawerIn: number | null; drawerOut: number | null;
    /** Cash paid back from the drawer for returned bottles. */
    refundsCash?: number | null;
    expectedCash: number | null; expensesAll: number;
    entries: Array<{ entryNo: string; direction: "IN" | "OUT"; category: string; source: string; fromDrawer: boolean; amount: number; party: string | null; note: string | null; reference: string | null; time: string; recordedBy: string; voided: boolean; voidReason: string | null; voidedBy: string | null; automatic: boolean }>;
  };
  /** returned = back on the shelf from customers; damaged = off the shelf into damaged stock (older reports have neither). */
  stockBook: Array<{ productId: number; name: string; size: string | null; brand: string; category: string; opening: number; received: number; sold: number; returned?: number; damaged?: number; transferIn?: number; transferOut?: number; adjusted: number; closing: number }>;
  empties: Array<{ name: string; collected: number; returned: number; onHand: number }>;
  /** How takings came in, with every split bill (older reports don't have these). Amounts are null in the cashier's blind view. */
  payments?: {
    rows: Array<{ method: string; bills: number; amount: number | null }>;
    splitBills: Array<{ billNo: string; time: string; cashier: string; total: number | null; cash: number | null; card: number; transfer: number; reference: string | null; change: number }>;
    changeGiven: number | null;
    wallet?: { bills: number; amount: number };
  };
  /** Customer wallets: change kept and wallet money spent during the shift, member by member. */
  wallet?: {
    kept: number | null; used: number; refunded?: number;
    rows: Array<{ time: string; member: string; mobile: string; type: "CREDIT" | "DEBIT" | "REFUND"; amount: number | null; balanceAfter: number; billNo: string | null; by: string }>;
  };
  /** Returns & damages during the shift: exchanges, refunds, store damage, damaged stock cleared. */
  returns?: {
    refunds: number; refundUnits: number; refundsCash: number | null; refundsWallet: number; refundsTotal: number | null; pointsReversed: number;
    exchangedUnits: number; storeDamagedUnits: number; clearedUnits: number; damageCost: number;
    rows: Array<{
      returnNo: string; time: string; type: "EXCHANGE" | "REFUND" | "STORE_DAMAGE" | "DAMAGE_CLEARED"; what: string; product: string; quantity: number;
      condition: "SHELF" | "DAMAGED" | null; disposal: string | null; billNo: string | null; customer: string | null;
      refund: number | null; refundMethod: "CASH" | "WALLET" | null; pointsReversed: number; reason: string; note: string | null; reference: string | null; by: string;
    }>;
  };
  /** Supplier deliveries (GRN) and branch transfers (GTN) during the shift. */
  goods?: {
    grns: Array<{ grnNo: string; time: string; supplier: string; poNumber: string | null; invoiceNo: string | null; invoiceTotal: number | null; totalCost: number; accepted: number; rejected: number; free?: number; freeValue?: number; items: string; by: string }>;
    sent: Array<{ gtnNo: string; time: string; branch: string; status: string; units: number; items: string; by: string }>;
    received: Array<{ gtnNo: string; time: string; branch: string; units: number; damaged: number; missing: number; items: string; note: string | null; by: string }>;
  };
  /** How often the cash drawer opened: once per cash bill, plus "no sale" opens with the reason. */
  drawer?: {
    cashBills: number;
    noSaleCount: number;
    noSale: Array<{ openNo: string; at: string; reason: string; openedBy: string }>;
  };
  /** Damaged bottles kept aside: added and cleared this shift, and on hand. */
  damagedStock?: Array<{ name: string; added: number; cleared: number; onHand: number }>;
  /** Stock received, corrected or returned during the shift, with where it came from and who did it. */
  stockLog?: Array<{ time: string; product: string; what: string; quantity: number; reference: string | null; by: string }>;
  /** Everything else done while the shift was open: price changes, purchase orders, settings, sign-ins… */
  journal?: Array<{ time: string; by: string; category: string; summary: string }>;
  close?: {
    countedCash: number; expectedCash: number; difference: number; differenceReason: string | null; cardSlipTotal: number | null; cardDifference: number | null; cardDifferenceReason?: string | null;
    floatLeft: number; cashBanked: number; notes: string | null; stockCount: Array<{ name: string; system: number; counted: number; difference: number }>;
    denominations?: { counts?: Record<string, number> } | null;
  };
};

const amt = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const signed = (value: number) => (Math.abs(value) < 0.005 ? "0.00" : `${value > 0 ? "+" : "−"}${amt(Math.abs(value))}`);

const header = (band: string) => `
  <div class="center">
    <div class="shop">${esc(SHOP.name)}</div>
    ${SHOP.tagline ? `<div class="tagline">${esc(SHOP.tagline)}</div>` : ""}
    <div class="addr">${esc(SHOP.address)}</div>
    ${SHOP.phone ? `<div class="addr">Tel: ${esc(SHOP.phone)}</div>` : ""}
  </div>
  <div class="band">${esc(band)}</div>`;

export function zReportFileName(report: ShiftReport) {
  const date = new Date(report.shift.closedAt ?? report.shift.openedAt);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `Z-Report_${report.shift.shiftNo}_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 80mm Z report: sales, staff, drawer balance, expenses, stock day book, empties and signatures. */
export function buildZReportHtml(report: ShiftReport) {
  const { shift, sales, cash, close } = report;
  const entries = cash.entries.filter((entry) => !entry.automatic);
  const stockRows = report.stockBook.filter((row) => row.opening || row.received || row.sold || row.adjusted || row.returned || row.damaged || row.transferIn || row.transferOut || row.closing);
  const counted = new Map((close?.stockCount ?? []).map((row) => [row.name, row]));

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(zReportFileName(report))}</title><style>${THERMAL_BASE_CSS}
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th { text-align: right; font-weight: 800; border-bottom: 1px solid #000; padding: 2px 1px; }
    th:first-child, td:first-child { text-align: left; }
    td { text-align: right; padding: 2px 1px; border-bottom: 1px dotted #aaa; font-variant-numeric: tabular-nums; }
    .void { text-decoration: line-through; color: #555; }
    .entry { padding: 3px 0; border-bottom: 1px dotted #aaa; font-size: 11px; }
    .flag { font-weight: 800; }
  </style></head><body>
    ${header(shift.status === "CLOSED" ? "Z REPORT · SHIFT CLOSE" : "X REPORT · SHIFT SO FAR")}
    <div class="meta">
      ${shift.branch ? `<div class="row"><span>Branch</span><span>${esc(shift.branch.name)}</span></div>` : ""}
      <div class="row"><span>Shift</span><span>${esc(shift.shiftNo)}</span></div>
      <div class="row"><span>Opened</span><span>${when(shift.openedAt)}</span></div>
      <div class="row"><span>Opened by</span><span>${esc(shift.openedBy)}</span></div>
      ${shift.closedAt ? `<div class="row"><span>Closed</span><span>${when(shift.closedAt)}</span></div><div class="row"><span>Closed by</span><span>${esc(shift.closedBy ?? "—")}</span></div>` : ""}
    </div>

    <div class="head">Sales</div>
    <div class="row"><span>Bills</span><span>${sales.bills}</span></div>
    <div class="row"><span>Units sold</span><span>${sales.units}</span></div>
    <div class="row"><span>Gross sales</span><span>${amt(sales.grossSales)}</span></div>
    ${sales.emptyDeduction ? `<div class="row"><span>Empty bottles (${sales.emptiesReturned})</span><span>−${amt(sales.emptyDeduction)}</span></div>` : ""}
    ${sales.discounts ? `<div class="row"><span>Discounts</span><span>−${amt(sales.discounts)}</span></div>` : ""}
    ${sales.pointsValue ? `<div class="row"><span>Loyalty points (${sales.pointsRedeemed})</span><span>−${amt(sales.pointsValue)}</span></div>` : ""}
    <div class="box"><div class="row"><span>NET SALES</span><span>${amt(sales.netSales)}</span></div></div>
    ${sales.walletUsed ? `<div class="row"><span>Customer wallets</span><span>${amt(sales.walletUsed)}</span></div>` : ""}
    <div class="row"><span>Cash</span><span>${amt(sales.cashSales)}</span></div>
    <div class="row"><span>Card</span><span>${amt(sales.cardSales)}</span></div>
    ${sales.transferSales ? `<div class="row"><span>Transfer / QR</span><span>${amt(sales.transferSales)}</span></div>` : ""}
    ${report.returns?.refunds ? `<div class="row"><span>Refunds for returns</span><span>−${amt(sales.refunds)}</span></div><div class="row strong"><span>Net after returns</span><span>${amt(sales.netAfterReturns)}</span></div>` : ""}

    ${report.returns?.rows.length ? `
      <div class="head">Returns &amp; damages</div>
      ${report.returns.refunds ? `<div class="row"><span>Returned &amp; refunded (${report.returns.refundUnits} btl)</span><span>${amt(report.returns.refundsTotal)}</span></div>
      <div class="row small"><span>&nbsp;· cash ${amt(report.returns.refundsCash)} · wallet ${amt(report.returns.refundsWallet)}</span><span></span></div>` : ""}
      ${report.returns.exchangedUnits ? `<div class="row"><span>Damaged bottles exchanged</span><span>${report.returns.exchangedUnits}</span></div>` : ""}
      ${report.returns.storeDamagedUnits ? `<div class="row"><span>Damaged in store</span><span>${report.returns.storeDamagedUnits}</span></div>` : ""}
      ${report.returns.clearedUnits ? `<div class="row"><span>Damaged stock cleared</span><span>${report.returns.clearedUnits}</span></div>` : ""}
      <table><tr><th>No. · item</th><th>Qty</th><th>Money</th></tr>
        ${report.returns.rows.map((row) => `<tr><td style="text-align:left">${esc(row.returnNo)} ${esc(row.what)}<br>${esc(row.product)} · ${esc(row.by)}</td><td>${row.quantity}</td><td>${row.type === "REFUND" ? `−${amt(row.refund)}${row.refundMethod === "WALLET" ? " W" : ""}` : "—"}</td></tr>`).join("")}
      </table>` : ""}

    <div class="head">Sales by staff</div>
    <table><tr><th>Staff</th><th>Bills</th><th>Cash</th><th>Card</th></tr>
      ${sales.byStaff.map((row) => `<tr><td>${esc(row.name)}</td><td>${row.bills}</td><td>${amt(row.cash)}</td><td>${amt(row.card)}</td></tr>`).join("") || `<tr><td colspan="4">No sales</td></tr>`}
    </table>

    ${sales.loyalty && (sales.loyalty.rows.length || sales.discounts || sales.pointsValue) ? `
      <div class="head">Discounts &amp; loyalty</div>
      <div class="row"><span>Discounted bills</span><span>${sales.loyalty.discountBills}</span></div>
      <div class="row"><span>Discounts given</span><span>${amt(sales.discounts)}</span></div>
      ${sales.loyalty.discountByStaff.map((row) => `<div class="row small"><span>&nbsp;· by ${esc(row.name)} (${row.bills})</span><span>${amt(row.amount)}</span></div>`).join("")}
      <div class="row"><span>Points used (${sales.pointsRedeemed})</span><span>${amt(sales.pointsValue)}</span></div>
      <div class="row"><span>Points earned</span><span>${sales.loyalty.pointsEarned}</span></div>
      <div class="row"><span>Member bills</span><span>${sales.loyalty.memberBills}</span></div>
      <table><tr><th>Bill · by</th><th>Off</th><th>Paid</th></tr>
        ${sales.loyalty.rows.filter((row) => row.discountAmount || row.pointsRedeemed).map((row) => `<tr><td style="text-align:left">${esc(row.billNo.slice(-9))} · ${esc(row.cashier)}${row.member ? `<br>${esc(row.member)}` : ""}</td><td>${row.discountType ? `${esc(discountText(row))} ` : ""}${row.pointsRedeemed ? `${row.pointsRedeemed}pt` : ""}<br>−${amt((row.discountAmount ?? 0) + (row.pointsValue ?? 0))}</td><td>${amt(row.total)}</td></tr>`).join("")}
      </table>` : ""}

    ${report.payments ? `
      <div class="head">Payments</div>
      ${report.payments.rows.filter((row) => row.bills > 0).map((row) => `<div class="row"><span>${esc(row.method)} (${row.bills})</span><span>${amt(row.amount)}</span></div>`).join("")}
      ${report.payments.splitBills.map((row) => `<div class="row small"><span>&nbsp;· ${esc(row.billNo.slice(-9))}: cash ${amt(row.cash)}${row.card ? ` + card ${amt(row.card)}` : ""}${row.transfer ? ` + QR ${amt(row.transfer)}` : ""}</span><span></span></div>`).join("")}
      <div class="row small"><span>Change given back</span><span>${amt(report.payments.changeGiven)}</span></div>` : ""}
    ${report.goods && (report.goods.grns.length || report.goods.sent.length || report.goods.received.length) ? `
      <div class="head">Goods in &amp; out</div>
      ${report.goods.grns.map((row) => `<div class="row small"><span>${esc(row.grnNo)} ${esc(row.supplier)}${row.invoiceNo ? ` inv ${esc(row.invoiceNo)}` : ""}${row.rejected ? ` (${row.rejected} rej)` : ""}${row.free ? ` (+${row.free} free)` : ""}</span><span>+${row.accepted + (row.free ?? 0)}</span></div>`).join("")}
      ${report.goods.sent.map((row) => `<div class="row small"><span>${esc(row.gtnNo)} to ${esc(row.branch)}</span><span>−${row.units}</span></div>`).join("")}
      ${report.goods.received.map((row) => `<div class="row small"><span>${esc(row.gtnNo)} from ${esc(row.branch)}${row.missing ? ` · ${row.missing} MISSING` : ""}</span><span>+${row.units}</span></div>`).join("")}` : ""}
    ${report.stockLog?.length || report.journal?.length ? `
      <div class="head">Also during the shift</div>
      ${report.stockLog?.length ? `<div class="row"><span>Stock in &amp; changes</span><span>${report.stockLog.length}</span></div>` : ""}
      ${report.journal?.length ? `<div class="row"><span>Other actions (journal)</span><span>${report.journal.length}</span></div>` : ""}
      <div class="small">Full list on the A4 Day End report.</div>` : ""}

    <div class="head">Cash drawer</div>
    <div class="row"><span>Opening float</span><span>${amt(cash.openingFloat)}</span></div>
    <div class="row"><span>+ Cash sales</span><span>${amt(cash.cashSales)}</span></div>
    ${cash.walletKept !== undefined && cash.walletKept !== 0 ? `<div class="row"><span>+ Change kept in wallets</span><span>${amt(cash.walletKept)}</span></div>` : ""}
    <div class="row"><span>+ Cash in</span><span>${amt(cash.drawerIn)}</span></div>
    <div class="row"><span>− Paid out (expenses)</span><span>${amt(cash.drawerOut)}</span></div>
    ${cash.refundsCash !== undefined && cash.refundsCash !== 0 ? `<div class="row"><span>− Cash refunds (returns)</span><span>${amt(cash.refundsCash)}</span></div>` : ""}
    <div class="row strong"><span>= Expected in drawer</span><span>${amt(close?.expectedCash ?? cash.expectedCash)}</span></div>
    ${close ? `
      <div class="row strong"><span>Counted</span><span>${amt(close.countedCash)}</span></div>
      <div class="box"><div class="row"><span>${close.difference > 0.004 ? "OVER" : close.difference < -0.004 ? "SHORT" : "BALANCED"}</span><span>${signed(close.difference)}</span></div></div>
      ${close.differenceReason ? `<div class="small">Reason: ${esc(close.differenceReason)}</div>` : ""}
      <div class="row"><span>Float left for next shift</span><span>${amt(close.floatLeft)}</span></div>
      <div class="row strong"><span>Cash banked / to safe</span><span>${amt(close.cashBanked)}</span></div>
      ${close.cardSlipTotal != null ? `<div class="row"><span>Card machine total</span><span>${amt(close.cardSlipTotal)}</span></div><div class="row"><span>Card difference</span><span>${signed(close.cardDifference ?? 0)}</span></div>` : sales.cardSales ? `<div class="row"><span>Card machine</span><span>Not settled</span></div>` : ""}
      ${close.cardDifferenceReason ? `<div class="small">Card: ${esc(close.cardDifferenceReason)}</div>` : ""}
      ${close.denominations?.counts && Object.keys(close.denominations.counts).length ? `<div class="small" style="margin-top:3px">Notes/coins: ${Object.entries(close.denominations.counts).sort((a, b) => Number(b[0]) - Number(a[0])).map(([note, qty]) => `${note}×${qty}`).join("  ")}</div>` : ""}
    ` : ""}

    ${report.drawer ? `
    <div class="head">Drawer opened</div>
    <div class="row"><span>With a cash bill</span><span>${report.drawer.cashBills}</span></div>
    <div class="row strong"><span>No sale</span><span>${report.drawer.noSaleCount}</span></div>
    ${report.drawer.noSale.map((row) => `<div class="small">${new Date(row.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ${esc(row.openNo)} · ${esc(row.openedBy)} · ${esc(row.reason)}</div>`).join("")}` : ""}

    <div class="head">Expenses &amp; cash in (${entries.length})</div>
    ${entries.map((entry) => `
      <div class="entry ${entry.voided ? "void" : ""}">
        <div class="row"><span>${esc(entry.entryNo)} · ${esc(entry.category)}</span><span>${entry.direction === "OUT" ? "−" : "+"}${amt(entry.amount)}</span></div>
        <div class="small">${esc(entry.source)}${entry.party ? ` · ${esc(entry.party)}` : ""}${entry.note ? ` · ${esc(entry.note)}` : ""} · by ${esc(entry.recordedBy)}${entry.voided ? ` · VOIDED by ${esc(entry.voidedBy ?? "—")}: ${esc(entry.voidReason ?? "")}` : ""}</div>
      </div>`).join("") || `<div class="small">None</div>`}
    <div class="row strong" style="margin-top:3px"><span>Total expenses (all sources)</span><span>${amt(cash.expensesAll)}</span></div>

    <div class="head">Items sold</div>
    <table><tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
      ${sales.byProduct.map((row) => `<tr><td>${esc(row.name)}</td><td>${row.units}</td><td>${amt(row.amount)}</td></tr>`).join("") || `<tr><td colspan="3">No sales</td></tr>`}
    </table>

    <div class="head">Stock book</div>
    <table><tr><th>Item</th><th>Open</th><th>+In</th><th>−Sold</th><th>Close</th>${close?.stockCount.length ? "<th>Count</th>" : ""}</tr>
      ${stockRows.map((row) => {
        const count = counted.get(row.name);
        const notes = [
          row.adjusted ? `adj ${row.adjusted > 0 ? "+" : ""}${row.adjusted}` : "",
          row.returned ? `ret +${row.returned}` : "",
          row.damaged ? `dmg −${row.damaged}` : "",
          row.transferIn ? `from branch +${row.transferIn}` : "",
          row.transferOut ? `to branch −${row.transferOut}` : "",
        ].filter(Boolean).join(", ");
        return `<tr><td>${esc(row.name)}${notes ? ` <span class="small">(${notes})</span>` : ""}</td><td>${row.opening}</td><td>${row.received}</td><td>${row.sold}</td><td>${row.closing}</td>${close?.stockCount.length ? `<td class="${count && count.difference ? "flag" : ""}">${count ? `${count.counted}${count.difference ? ` (${count.difference > 0 ? "+" : ""}${count.difference})` : ""}` : "—"}</td>` : ""}</tr>`;
      }).join("")}
    </table>

    ${report.empties.length ? `
      <div class="head">Empty bottles</div>
      <table><tr><th>Item</th><th>Collected</th><th>Returned</th><th>On hand</th></tr>
        ${report.empties.map((row) => `<tr><td>${esc(row.name)}</td><td>${row.collected}</td><td>${row.returned}</td><td>${row.onHand}</td></tr>`).join("")}
      </table>` : ""}

    ${report.damagedStock?.length ? `
      <div class="head">Damaged stock (kept aside)</div>
      <table><tr><th>Item</th><th>+In</th><th>−Out</th><th>On hand</th></tr>
        ${report.damagedStock.map((row) => `<tr><td>${esc(row.name)}</td><td>${row.added}</td><td>${row.cleared}</td><td>${row.onHand}</td></tr>`).join("")}
      </table>` : ""}

    <div class="head">Bills (${sales.billList.length})${sales.offlineBills ? ` · ${sales.offlineBills} sold offline` : ""}</div>
    <table><tr><th>Time</th><th>Bill · by</th><th>Total</th></tr>
      ${sales.billList.map((bill) => `<tr><td>${new Date(bill.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td><td style="text-align:left">${esc(bill.billNo.slice(-9))} · ${esc(bill.cashier)}${bill.payment === "Cash" ? "" : " · card"}${bill.offline ? " · OFFLINE" : ""}</td><td>${amt(bill.total)}</td></tr>`).join("") || `<tr><td colspan="3">No bills</td></tr>`}
    </table>

    ${close?.notes ? `<div class="head">Notes</div><div class="small">${esc(close.notes)}</div>` : ""}
    <div class="sign"><div>Cashier</div><div>Manager</div></div>
    <div class="printed">${esc(shift.shiftNo)} · printed ${when(new Date().toISOString())}</div>
  </body></html>`;
}

export function printZReport(report: ShiftReport) {
  printThermal(buildZReportHtml(report), zReportFileName(report));
}

// ── Vouchers (money out) and receipts (money in) ────────────────────────────

export type CashEntry = {
  id: number; entryNo: string; direction: "IN" | "OUT"; category: string; categoryLabel: string; amount: number; source: string; sourceLabel: string;
  party: string | null; reference: string | null; note: string | null; entryDate: string; automatic: boolean; voided: boolean; voidReason: string | null;
  shift: { shiftNo: string; status: string } | null; createdBy: { name: string; role: string } | null; voidedBy: { name: string } | null;
  /** Shift takings: PENDING until someone marks them banked. Null for ordinary entries. */
  bankStatus?: "PENDING" | "BANKED" | null; bankedAt?: string | null; bankReference?: string | null; bankedBy?: { name: string } | null;
};

export function buildCashEntryHtml(entry: CashEntry) {
  const isOut = entry.direction === "OUT";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(entry.entryNo)}</title><style>${THERMAL_BASE_CSS}
    .void { margin: 6px 0; padding: 4px; border: 2px solid #000; text-align: center; font-weight: 800; letter-spacing: 0.2em; }
  </style></head><body>
    ${header(isOut ? "PAYMENT VOUCHER" : "RECEIPT")}
    ${entry.voided ? `<div class="void">VOIDED</div><div class="small">${esc(entry.voidReason ?? "")}${entry.voidedBy ? ` — ${esc(entry.voidedBy.name)}` : ""}</div>` : ""}
    <div class="meta">
      <div class="row"><span>${isOut ? "Voucher" : "Receipt"} no</span><span>${esc(entry.entryNo)}</span></div>
      <div class="row"><span>Date</span><span>${when(entry.entryDate)}</span></div>
      <div class="row"><span>${isOut ? "For" : "Type"}</span><span>${esc(entry.categoryLabel)}</span></div>
      ${entry.party ? `<div class="row"><span>${isOut ? "Paid to" : "Received from"}</span><span>${esc(entry.party)}</span></div>` : ""}
      <div class="row"><span>${isOut ? "Paid from" : "Paid into"}</span><span>${esc(entry.sourceLabel)}</span></div>
      ${entry.bankStatus === "PENDING" ? `<div class="row"><span>Bank</span><span>NOT BANKED YET</span></div>` : ""}
      ${entry.bankStatus === "BANKED" ? `<div class="row"><span>Banked on</span><span>${when(entry.bankedAt ?? null)}</span></div>${entry.bankReference ? `<div class="row"><span>Deposit slip / ref</span><span>${esc(entry.bankReference)}</span></div>` : ""}${entry.bankedBy ? `<div class="row"><span>Marked by</span><span>${esc(entry.bankedBy.name)}</span></div>` : ""}` : ""}
      ${entry.reference ? `<div class="row"><span>Bill / ref no</span><span>${esc(entry.reference)}</span></div>` : ""}
      ${entry.shift ? `<div class="row"><span>Shift</span><span>${esc(entry.shift.shiftNo)}</span></div>` : ""}
    </div>
    <div class="box"><div class="row"><span>AMOUNT</span><span>Rs. ${amt(entry.amount)}</span></div></div>
    ${entry.note ? `<div class="small">${esc(entry.note)}</div>` : ""}
    <div class="small" style="margin-top:4px">Recorded by ${esc(entry.createdBy?.name ?? "—")}</div>
    <div class="sign">${isOut ? "<div>Prepared by</div><div>Approved by</div><div>Received by</div>" : "<div>Received by</div><div>Checked by</div>"}</div>
    <div class="printed">${esc(entry.entryNo)} · printed ${when(new Date().toISOString())}</div>
  </body></html>`;
}

export function printCashEntry(entry: CashEntry) {
  printThermal(buildCashEntryHtml(entry), `${entry.direction === "OUT" ? "Voucher" : "Receipt"}_${entry.entryNo}`);
}
