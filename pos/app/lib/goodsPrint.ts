import { SHOP } from "./shop";
import { escapeHtml as esc, printA4 } from "./print";
import { REPORT_CSS } from "./dayEndReport";

type BranchInfo = { id: number; name: string; code: string; address: string | null; phone: string | null };

/** Mirrors GET /api/pos/grns/:id */
export type GrnRecord = {
  id: number; grnNo: string; createdAt: string; branch: BranchInfo;
  supplierId: number | null; supplierName: string; supplier: { name: string; code: string; telephone: string | null; address: string | null } | null;
  purchaseOrderId: number | null; poNumber: string | null; supplierInvoiceNo: string | null; invoiceDate: string | null; invoiceTotal: number | null; invoiceDifference: number | null;
  notes: string | null; acceptedUnits: number; rejectedUnits: number; totalCost: number; receivedBy: string; shiftNo: string | null;
  items: Array<{ id: number; productId: number | null; description: string; orderedQty: number | null; deliveredQty: number; acceptedQty: number; rejectedQty: number; rejectReason: string | null; unitCost: number; lineTotal: number }>;
};

/** Mirrors GET /api/pos/gtns/:id */
export type GtnRecord = {
  id: number; gtnNo: string; status: "SENT" | "RECEIVED" | "CANCELLED"; statusLabel: string;
  fromBranch: BranchInfo; toBranch: BranchInfo; notes: string | null; carriedBy: string | null;
  sentAt: string; sentBy: string; receivedAt: string | null; receivedBy: string | null; receiveNote: string | null;
  cancelledAt: string | null; cancelledBy: string | null; cancelReason: string | null;
  items: Array<{ id: number; productId: number | null; productName: string; sentQty: number; receivedQty: number | null; damagedQty: number; missingQty: number; unitCost: number | null }>;
  totals: { sent: number; received: number; damaged: number; missing: number; value: number };
};

const amt = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const when = (value: string | null | undefined) => (value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const day = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const header = (title: string, number: string, stamp: string, branch: BranchInfo) => `
  <div class="top">
    <div>
      <div class="shop">${esc(SHOP.name)}</div>
      ${SHOP.tagline ? `<div class="tag">${esc(SHOP.tagline)}</div>` : ""}
      <div class="addr"><b>${esc(branch.name)}</b>${branch.address ? ` · ${esc(branch.address)}` : ""}${branch.phone ? ` · Tel ${esc(branch.phone)}` : ""}</div>
    </div>
    <div class="doc">
      <h1>${esc(title)}</h1>
      <div class="sub">${esc(number)}</div>
      <div class="stamp closed">${esc(stamp)}</div>
    </div>
  </div>`;

/** A4 Goods Received Note: what the supplier delivered, what was accepted or rejected, checked against the invoice. */
export function buildGrnHtml(grn: GrnRecord) {
  const diff = grn.invoiceDifference;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(grn.grnNo)}</title><style>${REPORT_CSS}</style></head><body><div class="sheet">
  ${header("Goods Received Note", grn.grnNo, grn.rejectedUnits ? `${grn.rejectedUnits} REJECTED` : "ALL ACCEPTED", grn.branch)}
  <div class="facts">
    <div><span>Supplier</span><b>${esc(grn.supplierName)}</b>${grn.supplier?.telephone ? `<span style="letter-spacing:0;text-transform:none;font-weight:500">${esc(grn.supplier.telephone)}</span>` : ""}</div>
    <div><span>Received</span><b>${when(grn.createdAt)}</b><span style="letter-spacing:0;text-transform:none;font-weight:500">by ${esc(grn.receivedBy)}</span></div>
    <div><span>Purchase order</span><b>${esc(grn.poNumber ?? "None")}</b></div>
    <div><span>Supplier invoice</span><b>${esc(grn.supplierInvoiceNo ?? "—")}</b>${grn.invoiceDate ? `<span style="letter-spacing:0;text-transform:none;font-weight:500">${day(grn.invoiceDate)}</span>` : ""}</div>
  </div>
  <section>
    <h2>Items delivered <small>${grn.items.length} line(s)</small></h2>
    <table>
      <thead><tr><th>#</th><th>Item</th>${grn.poNumber ? `<th class="r">Due on PO</th>` : ""}<th class="r">Delivered</th><th class="r">Rejected</th><th class="r">Accepted</th><th class="r">Unit cost</th><th class="r">Amount</th></tr></thead>
      ${grn.items.map((item, index) => `<tr><td>${index + 1}</td><td>${esc(item.description)}${item.rejectedQty ? `<div class="muted">Rejected: ${esc(item.rejectReason ?? "")}</div>` : ""}</td>${grn.poNumber ? `<td class="r">${item.orderedQty ?? "—"}</td>` : ""}<td class="r">${item.deliveredQty}</td><td class="r ${item.rejectedQty ? "flag" : ""}">${item.rejectedQty || "—"}</td><td class="r strong">${item.acceptedQty}</td><td class="r">${amt(item.unitCost)}</td><td class="r">${amt(item.lineTotal)}</td></tr>`).join("")}
      <tr class="total"><td colspan="${grn.poNumber ? 3 : 2}">Total</td><td class="r">${grn.acceptedUnits + grn.rejectedUnits}</td><td class="r">${grn.rejectedUnits || "—"}</td><td class="r">${grn.acceptedUnits}</td><td></td><td class="r">${amt(grn.totalCost)}</td></tr>
    </table>
    ${grn.invoiceTotal != null ? `<div class="result ${diff != null && Math.abs(diff) < 0.005 ? "ok" : "over"}"><span>${diff != null && Math.abs(diff) < 0.005 ? "SUPPLIER INVOICE MATCHES" : `SUPPLIER INVOICE ${amt(grn.invoiceTotal)} · DIFFERENCE`}</span><span>${diff != null && Math.abs(diff) >= 0.005 ? `${diff > 0 ? "+" : "−"}${amt(Math.abs(diff))}` : amt(grn.invoiceTotal)}</span></div>` : ""}
    ${grn.rejectedUnits ? `<div class="reason"><b>Rejected goods</b> were handed back to the supplier's driver and are not in stock.</div>` : ""}
    ${grn.notes ? `<div class="reason"><b>Notes:</b> ${esc(grn.notes)}</div>` : ""}
  </section>
  <div class="sign"><div><b>Delivered by (driver)</b>Name &amp; signature</div><div><b>Received &amp; checked by</b>${esc(grn.receivedBy)}</div><div><b>Approved</b>Manager</div></div>
  <div class="foot"><span>${esc(grn.grnNo)} · ${esc(grn.branch.name)}${grn.shiftNo ? ` · shift ${esc(grn.shiftNo)}` : ""}</span><span>Printed ${when(new Date().toISOString())}</span></div>
  </div></body></html>`;
}

/** A4 Goods Transfer Note: sent from one branch, checked in at the other. */
export function buildGtnHtml(gtn: GtnRecord) {
  const received = gtn.status === "RECEIVED";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(gtn.gtnNo)}</title><style>${REPORT_CSS}</style></head><body><div class="sheet">
  ${header("Goods Transfer Note", gtn.gtnNo, gtn.statusLabel.toUpperCase(), gtn.fromBranch)}
  <div class="facts">
    <div><span>From</span><b>${esc(gtn.fromBranch.name)}</b></div>
    <div><span>To</span><b>${esc(gtn.toBranch.name)}</b>${gtn.toBranch.address ? `<span style="letter-spacing:0;text-transform:none;font-weight:500">${esc(gtn.toBranch.address)}</span>` : ""}</div>
    <div><span>Sent</span><b>${when(gtn.sentAt)}</b><span style="letter-spacing:0;text-transform:none;font-weight:500">by ${esc(gtn.sentBy)}</span></div>
    <div><span>${gtn.status === "CANCELLED" ? "Cancelled" : "Received"}</span><b>${when(gtn.status === "CANCELLED" ? gtn.cancelledAt : gtn.receivedAt)}</b>${gtn.receivedBy || gtn.cancelledBy ? `<span style="letter-spacing:0;text-transform:none;font-weight:500">by ${esc(gtn.receivedBy ?? gtn.cancelledBy ?? "")}</span>` : ""}</div>
  </div>
  ${gtn.carriedBy ? `<div class="reason"><b>Carried by:</b> ${esc(gtn.carriedBy)}</div>` : ""}
  <section>
    <h2>Items <small>${gtn.totals.sent} bottle(s) · worth ${amt(gtn.totals.value)} at cost</small></h2>
    <table>
      <thead><tr><th>#</th><th>Item</th><th class="r">Sent</th><th class="r">Received good</th><th class="r">Damaged</th><th class="r">Missing</th><th class="r">Cost each</th></tr></thead>
      ${gtn.items.map((item, index) => `<tr><td>${index + 1}</td><td>${esc(item.productName)}</td><td class="r strong">${item.sentQty}</td><td class="r">${received ? item.receivedQty ?? 0 : ""}</td><td class="r">${received ? item.damagedQty || "—" : ""}</td><td class="r ${item.missingQty ? "flag" : ""}">${received ? item.missingQty || "—" : ""}</td><td class="r">${amt(item.unitCost)}</td></tr>`).join("")}
      <tr class="total"><td colspan="2">Total</td><td class="r">${gtn.totals.sent}</td><td class="r">${received ? gtn.totals.received : ""}</td><td class="r">${received ? gtn.totals.damaged || "—" : ""}</td><td class="r">${received ? gtn.totals.missing || "—" : ""}</td><td></td></tr>
    </table>
    ${gtn.notes ? `<div class="reason"><b>Note from ${esc(gtn.fromBranch.name)}:</b> ${esc(gtn.notes)}</div>` : ""}
    ${gtn.receiveNote ? `<div class="reason"><b>Note from ${esc(gtn.toBranch.name)}:</b> ${esc(gtn.receiveNote)}</div>` : ""}
    ${gtn.cancelReason ? `<div class="reason"><b>Cancelled:</b> ${esc(gtn.cancelReason)}</div>` : ""}
    ${received && gtn.totals.missing ? `<div class="result short"><span>${gtn.totals.missing} BOTTLE(S) MISSING IN TRANSIT</span><span></span></div>` : received ? `<div class="result ok"><span>ALL ACCOUNTED FOR</span><span></span></div>` : ""}
  </section>
  <div class="sign"><div><b>Sent by</b>${esc(gtn.sentBy)} · ${esc(gtn.fromBranch.name)}</div><div><b>Carried by</b>${esc(gtn.carriedBy ?? "Name & signature")}</div><div><b>Received by</b>${esc(gtn.receivedBy ?? "Name & signature")} · ${esc(gtn.toBranch.name)}</div></div>
  <div class="foot"><span>${esc(gtn.gtnNo)} · ${esc(gtn.fromBranch.name)} → ${esc(gtn.toBranch.name)}</span><span>Printed ${when(new Date().toISOString())}</span></div>
  </div></body></html>`;
}

export const printGrn = (grn: GrnRecord) => printA4(buildGrnHtml(grn), grn.grnNo);
export const printGtn = (gtn: GtnRecord) => printA4(buildGtnHtml(gtn), gtn.gtnNo);
