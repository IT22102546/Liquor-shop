import { escapeHtml as esc, printA4 } from "./print";
import { REPORT_CSS } from "./dayEndReport";
import type { ShopSettings } from "./useShopSettings";

/** Mirrors GET /api/pos/purchase-orders/:id */
export type PurchaseOrder = {
  id: number;
  poNumber: string;
  status: "DRAFT" | "SENT" | "PARTIAL" | "RECEIVED" | "CANCELLED";
  statusLabel: string;
  orderDate: string;
  expectedDate: string | null;
  notes: string | null;
  total: number;
  supplier: { id: number; name: string; code: string; contactPerson: string | null; telephone: string | null; address: string | null; email: string | null };
  items: Array<{ id: number; productId: number | null; description: string; quantity: number; unitCost: number; lineTotal: number; receivedQty: number; remaining: number; product: { id: number; name: string; quantity: number; partNumber: string | null } | null }>;
  emails: Array<{ id: number; toEmail: string; ccEmail: string | null; subject: string; status: "SENT" | "FAILED"; error: string | null; createdAt: string; sentBy: string }>;
  createdAt: string;
  createdBy: string;
  sentAt: string | null;
  sentBy: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  emailDefaults: { to: string; subject: string; message: string };
};

const amt = (value: number) => value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const longDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");

const EXTRA = `
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 12px 0 16px; }
  .party { border: 1px solid #e3e3e8; border-radius: 6px; padding: 10px 12px; }
  .party b { display: block; font-size: 10.5pt; margin: 2px 0; }
  .party div { font-size: 9pt; color: #444; }
  .grand td { font-size: 11pt; }
  .status { display: inline-block; margin-top: 6px; padding: 2px 9px; border: 1.5px solid currentColor; border-radius: 3px; font-size: 7.5pt; font-weight: 800; letter-spacing: .16em; }
  .status.CANCELLED { color: #b42318; }
`;

export function buildPurchaseOrderHtml(order: PurchaseOrder, shop: ShopSettings) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Purchase-Order_${esc(order.poNumber)}</title><style>${REPORT_CSS}${EXTRA}</style></head><body><div class="sheet">
  <div class="top">
    <div>
      <div class="shop">${esc(shop.businessName)}</div>
      <div class="addr">${esc(shop.businessAddress)}</div>
      <div class="addr">${[shop.businessPhone && `Tel ${esc(shop.businessPhone)}`, shop.businessEmail && esc(shop.businessEmail)].filter(Boolean).join(" · ")}</div>
    </div>
    <div class="doc">
      <h1>Purchase Order</h1>
      <div class="sub">${esc(order.poNumber)}</div>
      <div class="status ${order.status}">${esc(order.statusLabel.toUpperCase())}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party"><span class="label">Supplier</span><b>${esc(order.supplier.name)}</b>
      ${order.supplier.contactPerson ? `<div>Attn: ${esc(order.supplier.contactPerson)}</div>` : ""}
      ${order.supplier.address ? `<div>${esc(order.supplier.address)}</div>` : ""}
      <div>${[order.supplier.telephone && `Tel ${esc(order.supplier.telephone)}`, order.supplier.email && esc(order.supplier.email)].filter(Boolean).join(" · ")}</div>
    </div>
    <div class="party"><span class="label">Order</span>
      <div>Order date: <b style="display:inline">${longDate(order.orderDate)}</b></div>
      <div>Deliver by: <b style="display:inline">${order.expectedDate ? longDate(order.expectedDate) : "As soon as possible"}</b></div>
      <div>Deliver to: ${esc(shop.businessAddress)}</div>
      <div>Prepared by: ${esc(order.createdBy)}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>#</th><th>Item</th><th class="r">Quantity</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead>
    ${order.items.map((item, index) => `<tr><td>${index + 1}</td><td>${esc(item.description)}${item.product?.partNumber ? `<div class="muted">Barcode ${esc(item.product.partNumber)}</div>` : ""}</td><td class="r">${item.quantity}</td><td class="r">${amt(item.unitCost)}</td><td class="r">${amt(item.lineTotal)}</td></tr>`).join("")}
    <tr class="total grand"><td colspan="4">Total (Rs.)</td><td class="r">${amt(order.total)}</td></tr>
  </table>

  ${order.notes ? `<section><h2>Notes</h2><div class="notes">${esc(order.notes)}</div></section>` : ""}
  <p class="note" style="margin-top:14px;font-size:8.5pt;color:#555">Please quote ${esc(order.poNumber)} on your invoice and delivery note.</p>

  <div class="sign">
    <div><b>Prepared by</b>${esc(order.createdBy)}</div>
    <div><b>Approved by</b>Signature &amp; date</div>
    <div><b>Received by (supplier)</b>Signature &amp; date</div>
  </div>
  <div class="foot"><span>${esc(shop.businessName)} · ${esc(order.poNumber)}</span><span>Printed ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
  </div></body></html>`;
}

export function printPurchaseOrder(order: PurchaseOrder, shop: ShopSettings) {
  printA4(buildPurchaseOrderHtml(order, shop), `Purchase-Order_${order.poNumber}`);
}
