import { SHOP } from "./shop";
import { escapeHtml as esc } from "./print";
import { zReportFileName, type ShiftReport } from "./bookPrint";

/**
 * A4 Day End report: an office document (not a till slip) for the manager/owner file.
 * Same figures as the 80mm Z report, laid out as a proper report with summary boxes and tables.
 */

const amt = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const rs = (value: number | null | undefined) => (value == null ? "—" : `Rs. ${amt(value)}`);
const dateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const signed = (value: number) => (Math.abs(value) < 0.005 ? "0.00" : `${value > 0 ? "+" : "−"}${amt(Math.abs(value))}`);

const CSS = `
  @page { size: A4; margin: 14mm 13mm 16mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt "Helvetica Neue", Arial, sans-serif; color: #777; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { background: #e9e9ec; }
  body { font: 9.5pt/1.45 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #16161a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { background: #fff; width: 210mm; min-height: 297mm; margin: 12px auto; padding: 14mm 13mm 16mm; box-shadow: 0 6px 30px rgba(0,0,0,.18); }
  @media print { html { background: #fff; } .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; } }

  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 10px; border-bottom: 2.5px solid #16161a; }
  .shop { font-size: 19pt; font-weight: 800; letter-spacing: .06em; }
  .tag { font-size: 7.5pt; letter-spacing: .22em; text-transform: uppercase; color: #555; margin-top: 1px; }
  .addr { font-size: 8.5pt; color: #444; margin-top: 4px; }
  .doc { text-align: right; }
  .doc h1 { font-size: 15pt; font-weight: 800; letter-spacing: .02em; }
  .doc .sub { font-size: 8.5pt; color: #555; margin-top: 2px; }
  .stamp { display: inline-block; margin-top: 6px; padding: 2px 9px; border: 1.5px solid currentColor; border-radius: 3px; font-size: 7.5pt; font-weight: 800; letter-spacing: .16em; }
  .stamp.closed { color: #16161a; } .stamp.open { color: #a15c00; }

  .facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin: 10px 0 12px; border: 1px solid #d6d6db; border-radius: 6px; overflow: hidden; }
  .facts div { padding: 6px 9px; border-right: 1px solid #d6d6db; }
  .facts div:last-child { border-right: 0; }
  .facts span, .kpi span, .label { display: block; font-size: 6.8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #6b6b73; }
  .facts b { display: block; font-size: 9pt; margin-top: 1px; }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
  .kpi { padding: 9px 11px; border-radius: 6px; background: #f4f4f6; border: 1px solid #e3e3e8; }
  .kpi b { display: block; font-size: 14pt; font-weight: 800; margin-top: 3px; font-variant-numeric: tabular-nums; }
  .kpi em { display: block; font-style: normal; font-size: 7.5pt; color: #666; margin-top: 1px; }
  .kpi.dark { background: #16161a; border-color: #16161a; color: #fff; } .kpi.dark span, .kpi.dark em { color: #c9c9d1; }
  .kpi.short { background: #fdeeee; border-color: #f0b8b8; } .kpi.short b { color: #b42318; }
  .kpi.over { background: #fff6e5; border-color: #f2d196; } .kpi.over b { color: #a15c00; }
  .kpi.ok { background: #ebf7ef; border-color: #b6dfc3; } .kpi.ok b { color: #17803d; }

  h2 { font-size: 8pt; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #16161a; display: flex; justify-content: space-between; }
  h2 small { font-size: 7.5pt; font-weight: 600; letter-spacing: 0; text-transform: none; color: #666; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .cols h2 { margin-top: 0; }
  section.keep { break-inside: avoid; }
  h2 { break-after: avoid; }
  thead { display: table-header-group; }

  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th { font-size: 7pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #555; text-align: left; padding: 4px 6px; background: #f4f4f6; border-bottom: 1px solid #d6d6db; }
  td { padding: 4px 6px; border-bottom: 1px solid #ececf0; vertical-align: top; }
  tr { break-inside: avoid; }
  .r { text-align: right; } .c { text-align: center; }
  .muted { color: #6b6b73; font-size: 8pt; }
  .strong td, td.strong { font-weight: 800; }
  .total td { font-weight: 800; border-top: 1.5px solid #16161a; border-bottom: 0; background: #fafafb; }
  .minus { color: #b42318; } .plus { color: #17803d; }
  .void td { color: #999; } .void td.amount { text-decoration: line-through; }
  .flag { color: #b42318; font-weight: 800; }
  .ledger td { padding: 3.5px 6px; } .ledger td:first-child { color: #333; }
  .result { margin-top: 6px; padding: 7px 9px; border-radius: 5px; display: flex; justify-content: space-between; font-weight: 800; font-size: 10.5pt; }
  .result.ok { background: #ebf7ef; color: #17803d; } .result.short { background: #fdeeee; color: #b42318; } .result.over { background: #fff6e5; color: #a15c00; }
  .reason { margin-top: 5px; font-size: 8.5pt; } .reason b { font-weight: 700; }
  .empty { color: #888; font-style: italic; padding: 6px; }
  .notes { padding: 8px 10px; border: 1px solid #e3e3e8; border-radius: 5px; background: #fafafb; white-space: pre-wrap; }

  .sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 34px; break-inside: avoid; }
  .sign div { border-top: 1px solid #16161a; padding-top: 4px; font-size: 8pt; color: #444; }
  .sign b { display: block; font-size: 8.5pt; color: #16161a; }
  .foot { margin-top: 16px; padding-top: 6px; border-top: 1px solid #e3e3e8; display: flex; justify-content: space-between; font-size: 7.5pt; color: #888; }
`;

export function buildDayEndReportHtml(report: ShiftReport) {
  const { shift, sales, cash, close } = report;
  const closed = shift.status === "CLOSED";
  const entries = cash.entries.filter((entry) => !entry.automatic);
  const stockRows = report.stockBook.filter((row) => row.opening || row.received || row.sold || row.adjusted || row.closing);
  const counted = new Map((close?.stockCount ?? []).map((row) => [row.name, row]));
  const hasCount = Boolean(close?.stockCount.length);
  const diff = close?.difference ?? 0;
  const tone = Math.abs(diff) < 0.005 ? "ok" : diff > 0 ? "over" : "short";
  const toneLabel = tone === "ok" ? "Balanced" : tone === "over" ? "Over" : "Short";
  const notes = close?.denominations?.counts ?? {};
  const noteRows = Object.entries(notes).filter(([, qty]) => qty > 0).sort((a, b) => Number(b[0]) - Number(a[0]));
  const hasTransfer = Boolean(sales.transferSales);
  const cardRows = sales.cardPayments ?? [];
  const transferRows = sales.transferPayments ?? [];
  const cardDiff = close?.cardDifference ?? 0;
  const payTable = (rows: typeof cardRows, refLabel: string) => `<table>
      <thead><tr><th>Time</th><th>Bill no</th><th>Taken by</th><th>${refLabel}</th><th class="r">Amount</th></tr></thead>
      ${rows.map((row) => `<tr><td>${timeOnly(row.time)}</td><td>${esc(row.billNo)}</td><td>${esc(row.cashier)}</td><td>${esc(row.reference ?? "—")}</td><td class="r">${amt(row.amount)}</td></tr>`).join("")}
      <tr class="total"><td colspan="4">Total (${rows.length})</td><td class="r">${amt(rows.reduce((s, r) => s + r.amount, 0))}</td></tr>
    </table>`;
  const outTotal = entries.filter((e) => e.direction === "OUT" && !e.voided).reduce((sum, e) => sum + e.amount, 0);
  const inTotal = entries.filter((e) => e.direction === "IN" && !e.voided).reduce((sum, e) => sum + e.amount, 0);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(zReportFileName(report).replace("Z-Report", "Day-End-Report"))}</title><style>${CSS}</style></head><body><div class="sheet">

  <div class="top">
    <div>
      <div class="shop">${esc(SHOP.name)}</div>
      ${SHOP.tagline ? `<div class="tag">${esc(SHOP.tagline)}</div>` : ""}
      <div class="addr">${esc(SHOP.address)}${SHOP.phone ? ` · Tel ${esc(SHOP.phone)}` : ""}</div>
    </div>
    <div class="doc">
      <h1>${closed ? "Day End Report" : "Shift Report (in progress)"}</h1>
      <div class="sub">${longDate(shift.closedAt ?? shift.openedAt)}</div>
      <div class="stamp ${closed ? "closed" : "open"}">${closed ? "Z · SHIFT CLOSED" : "X · NOT CLOSED YET"}</div>
    </div>
  </div>

  <div class="facts">
    <div><span>Shift</span><b>${esc(shift.shiftNo)}</b></div>
    <div><span>Opened</span><b>${dateTime(shift.openedAt)}</b><span style="letter-spacing:0;text-transform:none;font-weight:500">by ${esc(shift.openedBy)}</span></div>
    <div><span>Closed</span><b>${dateTime(shift.closedAt)}</b>${shift.closedBy ? `<span style="letter-spacing:0;text-transform:none;font-weight:500">by ${esc(shift.closedBy)}</span>` : ""}</div>
    <div><span>Drawer counted</span><b>${dateTime(shift.countedAt)}</b>${shift.countedBy ? `<span style="letter-spacing:0;text-transform:none;font-weight:500">by ${esc(shift.countedBy)}</span>` : ""}</div>
  </div>

  <div class="kpis">
    <div class="kpi dark"><span>Net sales</span><b>${rs(sales.netSales)}</b><em>${sales.bills} bills · ${sales.units} units</em></div>
    <div class="kpi"><span>Cash sales</span><b>${rs(sales.cashSales)}</b><em>Card ${rs(sales.cardSales)}${sales.transferSales ? ` · Transfer ${rs(sales.transferSales)}` : ""}</em></div>
    <div class="kpi"><span>Paid out</span><b>${rs(cash.expensesAll)}</b><em>${entries.filter((e) => e.direction === "OUT" && !e.voided).length} expense voucher(s)</em></div>
    ${close
      ? `<div class="kpi ${tone}"><span>Drawer result</span><b>${toneLabel}${tone === "ok" ? "" : ` ${amt(Math.abs(diff))}`}</b><em>Banked ${rs(close.cashBanked)}</em></div>`
      : `<div class="kpi"><span>Expected in drawer</span><b>${rs(cash.expectedCash)}</b><em>Not counted yet</em></div>`}
  </div>

  <div class="cols">
    <section class="keep">
      <h2>Sales summary</h2>
      <table class="ledger">
        <tr><td>Gross sales</td><td class="r">${amt(sales.grossSales)}</td></tr>
        ${sales.emptyDeduction ? `<tr><td>Less: empty bottles returned (${sales.emptiesReturned})</td><td class="r minus">−${amt(sales.emptyDeduction)}</td></tr>` : ""}
        ${sales.discounts ? `<tr><td>Less: discounts</td><td class="r minus">−${amt(sales.discounts)}</td></tr>` : ""}
        ${sales.pointsValue ? `<tr><td>Less: loyalty points redeemed (${sales.pointsRedeemed})</td><td class="r minus">−${amt(sales.pointsValue)}</td></tr>` : ""}
        <tr class="total"><td>Net sales</td><td class="r">${amt(sales.netSales)}</td></tr>
        <tr><td>Received in cash</td><td class="r">${amt(sales.cashSales)}</td></tr>
        <tr><td>Received by card</td><td class="r">${amt(sales.cardSales)}</td></tr>
        ${sales.transferSales != null ? `<tr><td>Received by bank transfer / QR</td><td class="r">${amt(sales.transferSales)}</td></tr>` : ""}
      </table>
    </section>
    <section class="keep">
      <h2>Cash drawer</h2>
      <table class="ledger">
        <tr><td>Opening float</td><td class="r">${amt(cash.openingFloat)}</td></tr>
        <tr><td>Add: cash sales</td><td class="r plus">+${amt(cash.cashSales)}</td></tr>
        <tr><td>Add: cash in</td><td class="r plus">+${amt(cash.drawerIn)}</td></tr>
        <tr><td>Less: paid out from drawer</td><td class="r minus">−${amt(cash.drawerOut)}</td></tr>
        <tr class="total"><td>Expected in drawer</td><td class="r">${amt(close?.expectedCash ?? cash.expectedCash)}</td></tr>
        ${close ? `
        <tr class="strong"><td>Counted</td><td class="r">${amt(close.countedCash)}</td></tr>
        <tr><td>Float left for next shift</td><td class="r">${amt(close.floatLeft)}</td></tr>
        <tr class="strong"><td>Cash banked / to safe</td><td class="r">${amt(close.cashBanked)}</td></tr>` : ""}
      </table>
      ${close ? `<div class="result ${tone}"><span>${toneLabel.toUpperCase()}</span><span>${signed(diff)}</span></div>
      ${close.differenceReason ? `<div class="reason"><b>Reason:</b> ${esc(close.differenceReason)}</div>` : ""}` : ""}
    </section>
  </div>

  ${noteRows.length ? `
  <section class="keep">
    <h2>Cash count <small>notes and coins counted in the drawer</small></h2>
    <table>
      <thead><tr><th>Note / coin</th><th class="r">Count</th><th class="r">Amount</th></tr></thead>
      ${noteRows.map(([note, qty]) => `<tr><td>Rs. ${Number(note).toLocaleString()}</td><td class="r">${qty}</td><td class="r">${amt(Number(note) * qty)}</td></tr>`).join("")}
      <tr class="total"><td>Total counted</td><td class="r">${noteRows.reduce((s, [, q]) => s + q, 0)}</td><td class="r">${amt(close?.countedCash)}</td></tr>
    </table>
  </section>` : ""}

  ${cardRows.length || close?.cardSlipTotal != null ? `
  <section class="keep">
    <h2>Card payments <small>recorded automatically at the till · checked against the card machine</small></h2>
    ${payTable(cardRows, "Approval code")}
    <div class="result ${close?.cardSlipTotal == null ? "over" : Math.abs(cardDiff) < 0.005 ? "ok" : "short"}">
      <span>${close?.cardSlipTotal == null ? (closed ? "CARD MACHINE NOT SETTLED AT CLOSE" : "CARD MACHINE NOT CHECKED YET") : Math.abs(cardDiff) < 0.005 ? `CARD MACHINE MATCHES · ${amt(close.cardSlipTotal)}` : `CARD MACHINE ${amt(close.cardSlipTotal)} · DIFFERENCE`}</span>
      <span>${close?.cardSlipTotal == null ? "" : signed(cardDiff)}</span>
    </div>
    ${close?.cardDifferenceReason ? `<div class="reason"><b>Card note:</b> ${esc(close.cardDifferenceReason)}</div>` : ""}
  </section>` : ""}

  ${transferRows.length ? `
  <section class="keep">
    <h2>Bank transfer / QR payments <small>check these in the bank app</small></h2>
    ${payTable(transferRows, "Reference")}
  </section>` : ""}

  <section class="keep">
    <h2>Sales by staff</h2>
    <table>
      <thead><tr><th>Staff member</th><th class="r">Bills</th><th class="r">Cash</th><th class="r">Card</th>${hasTransfer ? `<th class="r">Transfer / QR</th>` : ""}<th class="r">Total</th></tr></thead>
      ${sales.byStaff.map((row) => `<tr><td>${esc(row.name)}</td><td class="r">${row.bills}</td><td class="r">${amt(row.cash)}</td><td class="r">${amt(row.card)}</td>${hasTransfer ? `<td class="r">${amt(row.transfer ?? 0)}</td>` : ""}<td class="r strong">${amt(row.total)}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">No sales in this shift</td></tr>`}
    </table>
  </section>

  <section>
    <h2>Expenses &amp; cash in <small>${entries.length} entr${entries.length === 1 ? "y" : "ies"}</small></h2>
    <table>
      <thead><tr><th>No</th><th>Time</th><th>Type</th><th>Paid to / from</th><th>Drawer / bank</th><th>Recorded by</th><th class="r">Amount</th></tr></thead>
      ${entries.map((entry) => `<tr class="${entry.voided ? "void" : ""}">
        <td>${esc(entry.entryNo)}</td><td>${timeOnly(entry.time)}</td>
        <td>${esc(entry.category)}${entry.note ? `<div class="muted">${esc(entry.note)}</div>` : ""}${entry.reference ? `<div class="muted">Ref ${esc(entry.reference)}</div>` : ""}${entry.voided ? `<div class="muted">VOIDED by ${esc(entry.voidedBy ?? "—")}: ${esc(entry.voidReason ?? "")}</div>` : ""}</td>
        <td>${esc(entry.party ?? "—")}</td><td>${esc(entry.source)}</td><td>${esc(entry.recordedBy)}</td>
        <td class="r amount ${entry.direction === "OUT" ? "minus" : "plus"}">${entry.direction === "OUT" ? "−" : "+"}${amt(entry.amount)}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No expenses or cash in</td></tr>`}
      ${entries.length ? `<tr class="total"><td colspan="6">Total paid out${inTotal ? ` · cash in ${amt(inTotal)}` : ""}</td><td class="r">${amt(outTotal)}</td></tr>` : ""}
    </table>
  </section>

  <section>
    <h2>Items sold</h2>
    <table>
      <thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead>
      ${sales.byProduct.map((row) => `<tr><td>${esc(row.name)}</td><td class="r">${row.units}</td><td class="r">${amt(row.amount)}</td></tr>`).join("") || `<tr><td colspan="3" class="empty">Nothing sold</td></tr>`}
      ${sales.byProduct.length ? `<tr class="total"><td>Total</td><td class="r">${sales.units}</td><td class="r">${amt(sales.byProduct.reduce((s, r) => s + (r.amount ?? 0), 0))}</td></tr>` : ""}
    </table>
  </section>

  <section>
    <h2>Stock book <small>opening + received − sold ± adjusted = closing${hasCount ? " · checked against the shelf count" : ""}</small></h2>
    <table>
      <thead><tr><th>Product</th><th class="r">Opening</th><th class="r">Received</th><th class="r">Sold</th><th class="r">Adjusted</th><th class="r">Closing</th>${hasCount ? `<th class="r">Counted</th><th class="r">Difference</th>` : ""}</tr></thead>
      ${stockRows.map((row) => {
        const count = counted.get(row.name);
        return `<tr><td>${esc(row.name)}<div class="muted">${esc([row.brand, row.size].filter(Boolean).join(" · "))}</div></td>
          <td class="r">${row.opening}</td><td class="r">${row.received || "—"}</td><td class="r">${row.sold || "—"}</td><td class="r">${row.adjusted ? (row.adjusted > 0 ? `+${row.adjusted}` : row.adjusted) : "—"}</td><td class="r strong">${row.closing}</td>
          ${hasCount ? `<td class="r">${count ? count.counted : "—"}</td><td class="r ${count && count.difference ? "flag" : ""}">${count ? (count.difference ? (count.difference > 0 ? `+${count.difference}` : count.difference) : "✓") : ""}</td>` : ""}</tr>`;
      }).join("") || `<tr><td colspan="8" class="empty">No stock movements</td></tr>`}
    </table>
  </section>

  ${report.empties.length ? `
  <section>
    <h2>Empty bottles</h2>
    <table>
      <thead><tr><th>Product</th><th class="r">Collected from customers</th><th class="r">Returned to supplier</th><th class="r">On hand</th></tr></thead>
      ${report.empties.map((row) => `<tr><td>${esc(row.name)}</td><td class="r">${row.collected}</td><td class="r">${row.returned}</td><td class="r">${row.onHand}</td></tr>`).join("")}
    </table>
  </section>` : ""}

  <section>
    <h2>Bills <small>${sales.billList.length} bill(s)</small></h2>
    <table>
      <thead><tr><th>Time</th><th>Bill no</th><th>Sold by</th><th>Customer</th><th>Items</th><th>Payment</th><th class="r">Total</th></tr></thead>
      ${sales.billList.map((bill) => `<tr><td>${timeOnly(bill.time)}</td><td>${esc(bill.billNo)}</td><td>${esc(bill.cashier)}</td><td>${esc(bill.customer)}</td><td class="muted">${esc(bill.items)}</td><td>${esc(bill.payment)}</td><td class="r">${amt(bill.total)}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No bills</td></tr>`}
      ${sales.billList.length ? `<tr class="total"><td colspan="6">Total</td><td class="r">${amt(sales.netSales)}</td></tr>` : ""}
    </table>
  </section>

  ${close?.notes ? `<section><h2>Notes</h2><div class="notes">${esc(close.notes)}</div></section>` : ""}

  <div class="sign">
    <div><b>Cashier</b>${esc(shift.closedBy ?? shift.openedBy)}</div>
    <div><b>Checked by (manager)</b>Name &amp; date</div>
    <div><b>Owner</b>Signature</div>
  </div>
  <div class="foot"><span>${esc(SHOP.name)} · ${esc(shift.shiftNo)}</span><span>Printed ${dateTime(new Date().toISOString())}</span></div>
  </div></body></html>`;
}

/** Prints (or saves as PDF) the A4 report through a hidden frame; the PDF gets a unique file name. */
export function printDayEndReport(report: ShiftReport) {
  const html = buildDayEndReportHtml(report);
  const fileName = zReportFileName(report).replace("Z-Report", "Day-End-Report");
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "210mm", height: "297mm", border: "0", opacity: "0" });
  frame.srcdoc = html;
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return;
    const pageTitle = document.title;
    document.title = fileName;
    const restore = () => { document.title = pageTitle; };
    win.addEventListener("afterprint", restore, { once: true });
    win.focus();
    win.print();
    window.setTimeout(() => { restore(); frame.remove(); }, 1000);
  };
  document.body.appendChild(frame);
}
