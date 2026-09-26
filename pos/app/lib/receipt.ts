import { SHOP } from "./shop";

export type ReceiptLine = {
  name: string;
  /** Brand and size, e.g. "Lion · 700ml". */
  detail?: string;
  quantity: number;
  unitPrice: number;
  empties: number;
  emptyPrice: number;
  emptyDeduction: number;
  /** Amount for the line after empties. */
  total: number;
};

export type SaleReceipt = {
  billNo: string;
  soldAt: string;
  cashierName: string;
  cashierRole: string;
  /** Loyalty member; null for a walk-in customer. */
  member?: { name: string; mobileNumber: string; pointsEarned: number; pointsBalance: number } | null;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CHEQUE";
  lines: ReceiptLine[];
  subtotal: number;
  emptyDeduction: number;
  emptiesReturned: number;
  total: number;
  amountReceived: number;
  change: number;
};

const PAYMENT_LABELS: Record<SaleReceipt["paymentMethod"], string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Card / Bank transfer",
  CHEQUE: "Cheque",
};

/** Shows only the last 3 digits of a member's mobile on paper, e.g. "07•••••123". */
const maskMobile = (mobile: string) => (mobile.length > 5 ? `${mobile.slice(0, 2)}${"•".repeat(mobile.length - 5)}${mobile.slice(-3)}` : mobile);

const amount = (value: number) =>
  value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);

/**
 * File name used when the receipt is saved as PDF, e.g. "Receipt_POS-MUI19MZ4-19TB_2026-09-26_12-23".
 * The bill number is unique per sale, so saved receipts never overwrite or duplicate each other.
 */
export function receiptFileName(receipt: SaleReceipt) {
  const soldAt = new Date(receipt.soldAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${soldAt.getFullYear()}-${pad(soldAt.getMonth() + 1)}-${pad(soldAt.getDate())}_${pad(soldAt.getHours())}-${pad(soldAt.getMinutes())}`;
  return `Receipt_${receipt.billNo.replace(/[^A-Za-z0-9-]/g, "")}_${stamp}`;
}

/** 80mm thermal-printer receipt as a standalone HTML document (also used for the on-screen preview). */
export function buildReceiptHtml(receipt: SaleReceipt) {
  const soldAt = new Date(receipt.soldAt);
  const date = soldAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = soldAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const units = receipt.lines.reduce((sum, line) => sum + line.quantity, 0);
  const isCash = receipt.paymentMethod === "CASH";

  const items = receipt.lines.map((line) => `
    <div class="item">
      <div class="item-name">${escape(line.name)}</div>
      ${line.detail ? `<div class="item-detail">${escape(line.detail)}</div>` : ""}
      <div class="row"><span>${line.quantity} × ${amount(line.unitPrice)}</span><span>${amount(line.quantity * line.unitPrice)}</span></div>
      ${line.empties > 0 ? `<div class="row deduct"><span>Empty bottles returned ${line.empties} × ${amount(line.emptyPrice)}</span><span>−${amount(line.emptyDeduction)}</span></div>` : ""}
    </div>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(receiptFileName(receipt))}</title><style>
    @page { size: 80mm 200mm; margin: 0; } /* replaced with the measured height when printing */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; }
    body { width: 80mm; padding: 5mm 4mm 6mm; font: 12px/1.35 "Helvetica Neue", Arial, sans-serif; color: #000;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .center { text-align: center; }
    .shop { font-size: 21px; font-weight: 800; letter-spacing: 0.08em; }
    .tagline { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 1px; }
    .addr { font-size: 11px; margin-top: 4px; }
    .band { margin: 8px 0 6px; padding: 4px 0; background: #000; color: #fff; text-align: center;
      font-size: 11px; font-weight: 700; letter-spacing: 0.24em; }
    .rule { border-top: 1px dashed #000; margin: 7px 0; }
    .rule.solid { border-top: 1.5px solid #000; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .row span:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .meta .row { font-size: 11.5px; padding: 1px 0; }
    .meta .row span:first-child { color: #333; }
    .meta .row span:last-child { font-weight: 700; }
    .head { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .item { padding: 5px 0; border-bottom: 1px dotted #999; }
    .items .item:last-child { border-bottom: 0; }
    .item-name { font-weight: 700; font-size: 12.5px; }
    .item-detail { font-size: 10.5px; color: #333; }
    .item .row { font-size: 11.5px; margin-top: 1px; }
    .deduct { font-style: italic; }
    .sums .row { padding: 1.5px 0; }
    .total { margin: 7px 0; padding: 6px 7px; border: 2px solid #000; border-radius: 4px; }
    .total .row { font-size: 17px; font-weight: 800; align-items: baseline; }
    .total .row span:first-child { font-size: 14px; letter-spacing: 0.12em; }
    .pay .row { padding: 1.5px 0; }
    .pay .strong { font-weight: 800; font-size: 13.5px; }
    .loyalty { margin-top: 8px; padding: 5px 7px; border: 1px solid #000; border-radius: 4px; }
    .loyalty-title { font-size: 10px; font-weight: 800; letter-spacing: 0.16em; text-align: center; margin-bottom: 2px; }
    .loyalty .row { font-size: 11.5px; padding: 1px 0; }
    .loyalty .strong { font-weight: 800; }
    .saved { margin-top: 7px; padding: 5px; border: 1px dashed #000; text-align: center; font-size: 11px; font-weight: 700; }
    .foot { margin-top: 9px; text-align: center; font-size: 11px; }
    .foot .thanks { font-size: 13px; font-weight: 800; margin-bottom: 2px; }
    .printed { margin-top: 8px; text-align: center; font-size: 9px; color: #444; }
    @media screen { body { margin: 0 auto; } }
  </style></head><body>
    <div class="center">
      <div class="shop">${escape(SHOP.name)}</div>
      ${SHOP.tagline ? `<div class="tagline">${escape(SHOP.tagline)}</div>` : ""}
      <div class="addr">${escape(SHOP.address)}</div>
      ${SHOP.phone ? `<div class="addr">Tel: ${escape(SHOP.phone)}</div>` : ""}
    </div>

    <div class="band">SALES RECEIPT</div>

    <div class="meta">
      <div class="row"><span>Bill No</span><span>${escape(receipt.billNo)}</span></div>
      <div class="row"><span>Date</span><span>${date}</span></div>
      <div class="row"><span>Time</span><span>${time}</span></div>
      <div class="row"><span>Served by</span><span>${escape(receipt.cashierName)}</span></div>
      <div class="row"><span>Role</span><span>${escape(receipt.cashierRole)}</span></div>
      <div class="row"><span>Payment</span><span>${PAYMENT_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}</span></div>
      <div class="row"><span>Customer</span><span>${receipt.member ? escape(receipt.member.name) : "Walk-in"}</span></div>
      ${receipt.member ? `<div class="row"><span>Member mobile</span><span>${escape(maskMobile(receipt.member.mobileNumber))}</span></div>` : ""}
    </div>

    <div class="rule solid"></div>
    <div class="row head"><span>Item</span><span>Amount (Rs.)</span></div>
    <div class="rule"></div>
    <div class="items">${items}</div>
    <div class="rule"></div>

    <div class="sums">
      <div class="row"><span>Items</span><span>${units} unit${units === 1 ? "" : "s"} · ${receipt.lines.length} product${receipt.lines.length === 1 ? "" : "s"}</span></div>
      <div class="row"><span>Subtotal</span><span>${amount(receipt.subtotal)}</span></div>
      ${receipt.emptyDeduction > 0 ? `<div class="row"><span>Empty bottles returned (${receipt.emptiesReturned})</span><span>−${amount(receipt.emptyDeduction)}</span></div>` : ""}
    </div>

    <div class="total"><div class="row"><span>TOTAL</span><span>Rs. ${amount(receipt.total)}</span></div></div>

    <div class="pay">
      ${isCash
        ? `<div class="row"><span>Cash received</span><span>${amount(receipt.amountReceived)}</span></div>
           <div class="row strong"><span>Change given</span><span>${amount(receipt.change)}</span></div>`
        : `<div class="row"><span>Paid by ${PAYMENT_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}</span><span>${amount(receipt.total)}</span></div>`}
    </div>

    ${receipt.member ? `<div class="loyalty">
      <div class="loyalty-title">LOYALTY POINTS</div>
      <div class="row"><span>Earned on this bill</span><span>+${receipt.member.pointsEarned}</span></div>
      <div class="row strong"><span>Points balance</span><span>${receipt.member.pointsBalance}</span></div>
    </div>` : ""}

    ${receipt.emptyDeduction > 0 ? `<div class="saved">You saved Rs. ${amount(receipt.emptyDeduction)} by returning ${receipt.emptiesReturned} empty bottle${receipt.emptiesReturned === 1 ? "" : "s"}</div>` : ""}

    <div class="rule"></div>
    <div class="foot">
      ${SHOP.footerLines.map((line, index) => `<div class="${index === 0 ? "thanks" : ""}">${escape(line)}</div>`).join("")}
      ${isCash && SHOP.cashFooterLine ? `<div>${escape(SHOP.cashFooterLine)}</div>` : ""}
    </div>
    <div class="printed">${escape(receipt.billNo)} · ${soldAt.toLocaleString("en-GB")}</div>
  </body></html>`;
}

/**
 * Prints the receipt through a hidden frame (no new window).
 * Browsers ignore "auto" page height and fall back to A4/Letter, which leaves the receipt in the
 * corner of a big page (e.g. when saving as PDF). So the receipt is measured once it has rendered
 * and the page is set to exactly 80mm × its height.
 */
export function printReceipt(receipt: SaleReceipt) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  // Laid out at receipt width (off-screen) so its height can be measured accurately.
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "80mm", height: "100px", border: "0", opacity: "0" });
  frame.srcdoc = buildReceiptHtml(receipt);
  frame.onload = () => {
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) return;
    const pxToMm = (px: number) => (px * 25.4) / 96;
    // Measure the receipt itself (body), not the frame, so there's no blank space at the bottom.
    const heightMm = Math.ceil(pxToMm(doc.body.getBoundingClientRect().height)) + 2;
    const pageStyle = doc.createElement("style");
    pageStyle.textContent = `@page { size: 80mm ${heightMm}mm; margin: 0; } @media print { html, body { width: 80mm; height: ${heightMm}mm; margin: 0; overflow: hidden; } }`;
    doc.head.appendChild(pageStyle);
    // Chrome names the saved PDF after the main page's title, not the frame's, so borrow it
    // for the receipt's own name while the print dialog is open, then put it back.
    const pageTitle = document.title;
    document.title = receiptFileName(receipt);
    const restoreTitle = () => { document.title = pageTitle; };
    win.addEventListener("afterprint", restoreTitle, { once: true });
    win.focus();
    win.print();
    window.setTimeout(() => { restoreTitle(); frame.remove(); }, 1000);
  };
  document.body.appendChild(frame);
}
