import { THERMAL_BASE_CSS, escapeHtml as esc, printThermal } from "./print";

/** Mirrors GET /api/pos/returns/:returnNo */
export type ReturnRecord = {
  returnNo: string;
  type: "EXCHANGE" | "REFUND" | "STORE_DAMAGE" | "DAMAGE_CLEARED";
  typeLabel: string;
  time: string;
  billNo: string | null;
  customer: string | null;
  mobile: string | null;
  refund: number;
  refundMethod: "CASH" | "WALLET" | null;
  pointsReversed: number;
  memberAfter: { points: number; wallet: number } | null;
  reason: string;
  note: string | null;
  disposal: string | null;
  disposalLabel: string | null;
  reference: string | null;
  shiftNo: string | null;
  by: string;
  lines: Array<{ product: string; quantity: number; condition: "SHELF" | "DAMAGED" | null; unitPrice: number; refund: number }>;
};

const amt = (value: number) => value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BANDS: Record<ReturnRecord["type"], string> = {
  EXCHANGE: "DAMAGED BOTTLE EXCHANGE",
  REFUND: "RETURN & REFUND",
  STORE_DAMAGE: "STORE DAMAGE NOTE",
  DAMAGE_CLEARED: "DAMAGED STOCK CLEARED",
};

/** 80mm slip for a return: what came back, what was given or paid back, and who did it (signed by both sides). */
export function buildReturnSlipHtml(record: ReturnRecord, shop: { name: string; address: string; phone: string }) {
  const time = new Date(record.time);
  const isRefund = record.type === "REFUND";
  const lines = record.lines.map((line) => `
    <div class="row"><span>${line.quantity} × ${esc(line.product)}</span><span>${isRefund ? amt(line.refund) : ""}</span></div>
    ${isRefund ? `<div class="row small"><span>&nbsp;&nbsp;${amt(line.unitPrice)} each · ${line.condition === "DAMAGED" ? "kept aside as damaged" : "back on the shelf"}</span><span></span></div>` : ""}`).join("");
  const customerSigns = record.type === "EXCHANGE" || record.type === "REFUND";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(record.returnNo)}</title><style>${THERMAL_BASE_CSS}</style></head><body>
    <div class="center"><div class="shop">${esc(shop.name)}</div>${shop.address ? `<div class="addr">${esc(shop.address)}</div>` : ""}${shop.phone ? `<div class="addr">${esc(shop.phone)}</div>` : ""}</div>
    <div class="band">${BANDS[record.type]}</div>
    <div class="meta">
      <div class="row"><span>No.</span><span>${esc(record.returnNo)}</span></div>
      <div class="row"><span>Date</span><span>${time.toLocaleDateString("en-GB")} ${time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span></div>
      ${record.billNo ? `<div class="row"><span>Bill</span><span>${esc(record.billNo)}</span></div>` : ""}
      ${record.customer ? `<div class="row"><span>Customer</span><span>${esc(record.customer)}</span></div>` : ""}
      ${record.mobile ? `<div class="row"><span>Mobile</span><span>${esc(record.mobile)}</span></div>` : ""}
      ${record.shiftNo ? `<div class="row"><span>Shift</span><span>${esc(record.shiftNo)}</span></div>` : ""}
      <div class="row"><span>By</span><span>${esc(record.by)}</span></div>
    </div>
    <div class="rule"></div>
    <div class="head">${record.type === "EXCHANGE" ? "Damaged bottle(s) taken back" : isRefund ? "Bottles returned" : "Bottles"}</div>
    ${lines}
    ${record.type === "EXCHANGE" ? `<div class="small" style="margin-top:4px">Replaced with the same number of new bottles. No money changed hands.</div>` : ""}
    ${isRefund ? `
      <div class="box"><div class="row"><span>${record.refundMethod === "WALLET" ? "TO WALLET" : "CASH BACK"}</span><span>Rs. ${amt(record.refund)}</span></div></div>
      ${record.pointsReversed ? `<div class="row small"><span>Points taken back</span><span>${record.pointsReversed}</span></div>` : ""}
      ${record.memberAfter ? `<div class="row small"><span>Points now</span><span>${record.memberAfter.points}</span></div><div class="row small"><span>Wallet now</span><span>Rs. ${amt(record.memberAfter.wallet)}</span></div>` : ""}` : ""}
    ${record.disposalLabel ? `<div class="row" style="margin-top:4px"><span>What happened</span><span>${esc(record.disposalLabel)}</span></div>` : ""}
    ${record.reference ? `<div class="row small"><span>Reference</span><span>${esc(record.reference)}</span></div>` : ""}
    <div class="rule"></div>
    <div class="small"><b>Reason:</b> ${esc(record.reason)}</div>
    ${record.note ? `<div class="small" style="margin-top:2px"><b>Note:</b> ${esc(record.note)}</div>` : ""}
    <div class="sign"><div>${customerSigns ? "Customer" : "Checked by"}</div><div>Staff</div></div>
    <div class="printed">Printed ${new Date().toLocaleString("en-GB")}</div>
  </body></html>`;
}

export function printReturnSlip(record: ReturnRecord, shop: { name: string; address: string; phone: string }) {
  printThermal(buildReturnSlipHtml(record, shop), record.returnNo);
}
