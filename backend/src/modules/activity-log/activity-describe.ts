import type { ActivityCategory } from "./activity-log.service";
import { EXPENSE_CATEGORIES as EXPENSE_LABELS, INCOME_CATEGORIES as INCOME_LABELS } from "../book/cash-book.service";

type Body = Record<string, unknown>;

/** Plain-language details shown when a log entry is opened. No technical data. */
export type ActivityDetails = {
  facts?: Array<{ label: string; value: string }>;
  changes?: Array<{ label: string; before: string; after: string }>;
  items?: Array<{ name: string; quantity: number; unitPrice: string; empties: number; emptyDeduction: string; total: string }>;
};

export type Described = {
  action: string;
  category: ActivityCategory;
  summary: string;
  entityType?: string;
  entityId?: string | number | null;
  details?: ActivityDetails;
};

const money = (value: unknown) =>
  typeof value === "number" ? `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
const str = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : "");
const obj = (value: unknown): Body => (value && typeof value === "object" && !Array.isArray(value) ? (value as Body) : {});
const nameOf = (value: unknown) => str(obj(value).name) || "None";
const fact = (label: string, value: unknown) => ({ label, value: str(value) || "—" });

const ROLE_NAMES: Record<string, string> = {
  ADMIN: "Administrator",
  CASHIER: "Cashier",
  INVENTORY_MANAGER: "Inventory Manager",
  ACCOUNTANT: "Accountant",
};
const PAYMENT_NAMES: Record<string, string> = { CASH: "Cash", CARD: "Card", BANK_TRANSFER: "Bank transfer / QR", CHEQUE: "Cheque", SPLIT: "Split (cash + card)" };
const role = (value: unknown) => ROLE_NAMES[str(value)] ?? str(value);
const payment = (value: unknown) => PAYMENT_NAMES[str(value)] ?? str(value);

// Product fields in the order they're shown, with how each value is displayed.
const PRODUCT_FIELDS: Array<[string, string, (product: Body) => string]> = [
  ["name", "Name", (p) => str(p.name)],
  ["brand", "Brand", (p) => nameOf(p.brand)],
  ["category", "Category", (p) => nameOf(p.category)],
  ["supplier", "Supplier", (p) => nameOf(p.supplier)],
  ["partNumber", "Barcode", (p) => str(p.partNumber) || "None"],
  ["compatibleWith", "Size / notes", (p) => str(p.compatibleWith) || "None"],
  ["quantity", "Stock", (p) => `${str(p.quantity)} units`],
  ["lowStockThreshold", "Low-stock alert", (p) => (Number(p.lowStockThreshold) > 0 ? `At ${str(p.lowStockThreshold)} units` : "Off")],
  ["sellingPrice", "Selling price", (p) => money(p.sellingPrice)],
  ["emptyBottlePrice", "Empty bottle price", (p) => (Number(p.emptyBottlePrice) > 0 ? money(p.emptyBottlePrice) : "Not returnable")],
  ["isHardLiquor", "Hard liquor (bill limit)", (p) => (p.isHardLiquor === true ? "Yes" : p.isHardLiquor === false ? "No" : "")],
  ["purchasePrice", "Cost per unit", (p) => money(p.purchasePrice)],
  ["taxPaid", "Tax per unit", (p) => money(p.taxPaid)],
  ["additionalExpenses", "Other costs per unit", (p) => money(p.additionalExpenses)],
  ["description", "Description", (p) => (str(p.description) ? "Updated text" : "None")],
];

function productChanges(before: Body, after: Body) {
  return PRODUCT_FIELDS
    .map(([, label, show]) => ({ label, before: show(before), after: show(after) }))
    .filter((change) => change.before !== change.after);
}

function changeSummary(changes: Array<{ label: string; before: string; after: string }>) {
  if (changes.length === 0) return "no changes";
  if (changes.length <= 2) {
    return changes.map((c) => `${c.label.toLowerCase()} ${c.before} → ${c.after}`).join(", ");
  }
  return `${changes.length} changes (${changes.map((c) => c.label.toLowerCase()).join(", ")})`;
}

const RESOURCE_LABELS: Record<string, [string, ActivityCategory]> = {
  "product-brands": ["brand", "PRODUCT"],
  "product-categories": ["category", "PRODUCT"],
  suppliers: ["supplier", "STOCK"],
  "invoice-accounts": ["invoice bank account", "ACCOUNTS"],
  "invoice-terms": ["invoice term", "ACCOUNTS"],
  chart: ["account", "ACCOUNTS"],
  receipts: ["receipt", "ACCOUNTS"],
  vouchers: ["voucher", "ACCOUNTS"],
  deposits: ["deposit", "ACCOUNTS"],
  payments: ["invoice payment", "ACCOUNTS"],
  "contact-requests": ["contact request", "OTHER"],
};
const SETTING_LABELS: Record<string, string> = {
  loyaltyRedemptionEnabled: "Loyalty points redemption",
  loyaltyRupeesPerPoint: "Rupees to earn 1 point",
  loyaltyPointValue: "Value of 1 point",
  discountsEnabled: "Bill discounts",
  maxCashierDiscountPercent: "Cashier discount limit",
  businessName: "Business name",
  businessAddress: "Business address",
  businessPhone: "Business phone",
  businessEmail: "Email for supplier replies",
  hardLiquorLimitEnabled: "Hard liquor limit per bill",
  hardLiquorLimit: "Most hard liquor bottles per bill",
  hardLiquorCategoryIds: "Categories counted as hard liquor",
};
function showSetting(key: string, value: unknown) {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (key === "hardLiquorCategoryIds") return Array.isArray(value) ? `${value.length} chosen categor${value.length === 1 ? "y" : "ies"}` : "Automatic (by name)";
  if (key === "hardLiquorLimit") return `${str(value)} bottles`;
  if (key === "loyaltyRupeesPerPoint" || key === "loyaltyPointValue") return money(Number(value));
  if (key === "maxCashierDiscountPercent") return `${str(value)}%`;
  return str(value) || "None";
}
const SUPPLIER_FIELDS: Array<[string, string]> = [
  ["name", "Name"], ["code", "Code"], ["contactPerson", "Contact person"], ["telephone", "Telephone"],
  ["email", "Email"], ["address", "Address"], ["fax", "Fax"], ["vatRegistrationNo", "VAT number"],
];
/** Shelf count at shift close: how many products were checked and which ones didn't match. */
function shelfCountFacts(value: unknown) {
  const rows = Array.isArray(value) ? (value as Body[]) : [];
  if (rows.length === 0) return [];
  const off = rows.filter((row) => Number(row.difference) !== 0);
  return [
    fact("Shelf count", `${rows.length} product(s) checked · ${off.length ? `${off.length} difference(s)` : "all match"}`),
    ...off.map((row) => fact(`  ${str(row.name)}`, `system ${str(row.system)}, counted ${str(row.counted)} (${Number(row.difference) > 0 ? "+" : ""}${str(row.difference)})`)),
  ];
}
const VERBS: Record<string, string> = { POST: "Added", PATCH: "Updated", PUT: "Updated", DELETE: "Deleted" };
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Turns a POS API change into a readable log line plus plain-language details.
 * `path` is relative to /api/pos. `before` is the record as it was before the change (when known),
 * `response` is what the API returned (the record after the change).
 */
export function describePosChange(method: string, path: string, body: Body, response: unknown, before?: Body): Described {
  const responseData = obj(response).data;
  const data = obj(responseData);
  const segments = path.split("/").filter(Boolean);
  const [module, resource, id, sub, subId, subAction] = segments;
  const prior = before ?? {};

  // ── Sales ────────────────────────────────────────────────────────────────
  if (module === "user-management" && resource === "checkout") {
    const lines = Array.isArray(data.purchases) ? (data.purchases as Body[]) : [];
    const empties = Number(data.emptiesReturned ?? 0);
    const member = obj(data.member);
    const itemCount = lines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
    // "3 × Lion Stout, 1 × Carlsberg +2 more" — names what was sold without making the line too long.
    const soldText = lines.slice(0, 2).map((line) => `${str(line.quantity)} × ${str(line.name)}`).join(", ")
      + (lines.length > 2 ? ` +${lines.length - 2} more` : "");
    return {
      action: "sale.checkout",
      category: "SALE",
      entityType: "sale",
      entityId: str(data.invoiceGroupCode),
      summary: `Sold ${soldText || `${itemCount} items`} for ${money(data.total)} · ${str(data.paymentMethod) === "SPLIT" ? `split: ${[Number(data.cashPaid) > 0 ? `cash ${money(data.cashPaid)}` : "", Number(data.cardPaid) > 0 ? `card ${money(data.cardPaid)}` : "", Number(data.transferPaid) > 0 ? `QR ${money(data.transferPaid)}` : ""].filter(Boolean).join(" + ")}` : payment(data.paymentMethod)}${empties > 0 ? ` · ${empties} empt${empties === 1 ? "y" : "ies"} returned` : ""}${member.name ? ` · ${str(member.name)}` : ""}${obj(data.discount).amount ? ` · discount −${money(obj(data.discount).amount)}` : ""}${Number(data.pointsRedeemed) > 0 ? ` · ${str(data.pointsRedeemed)} points used` : ""}${Number(data.walletUsed) > 0 ? ` · ${money(data.walletUsed)} from wallet` : ""}${Number(data.walletCredit) > 0 ? ` · ${money(data.walletCredit)} change kept in wallet` : ""}${Number(data.voucherPaid) > 0 ? ` · ${money(data.voucherPaid)} by gift voucher ${Array.isArray(data.giftVouchers) ? (data.giftVouchers as Body[]).map((voucher) => str(voucher.voucherNo)).join(", ") : ""}` : ""}${data.soldOffline ? ` · sold OFFLINE at ${new Date(obj(data.counterSale).createdAt as string | Date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" })}, uploaded later` : ""}${Array.isArray(data.stockShort) && data.stockShort.length ? ` · shelf count was short` : ""}`,
      details: {
        items: lines.map((line) => ({
          name: str(line.name),
          quantity: Number(line.quantity ?? 0),
          unitPrice: money(line.unitPrice),
          empties: Number(line.emptiesReturned ?? 0),
          emptyDeduction: money(line.emptyDeduction),
          total: money(line.lineTotal),
        })),
        facts: [
          fact("Bill number", data.invoiceGroupCode),
          ...(data.soldOffline ? [fact("Sold offline", `at ${new Date(obj(data.counterSale).createdAt as string | Date).toLocaleString("en-GB", { timeZone: "Asia/Colombo" })}, uploaded when the connection came back`)] : []),
          ...(Array.isArray(data.stockShort) ? (data.stockShort as Body[]).map((row) => fact("Shelf count short", `${str(row.name)}: sold ${str(row.short)} more than the count showed — count and correct it`)) : []),
          fact("Customer", member.name ? `${str(member.name)} (loyalty member)` : "Walk-in customer"),
          ...(member.name ? [fact("Points earned", `${str(member.pointsEarned)} (balance ${str(member.pointsBalance)})`)] : []),
          fact("Payment", payment(data.paymentMethod)),
          ...(str(data.paymentReference) ? [fact(str(data.paymentMethod) === "CARD" ? "Card approval code" : "Transfer reference", str(data.paymentReference))] : []),
          ...(empties > 0 ? [fact("Subtotal", money(data.subtotal)), fact("Empty bottles returned", `${empties} (− ${money(data.emptyDeduction)})`)] : []),
          ...(obj(data.discount).amount ? [fact("Discount", `${obj(data.discount).type === "PERCENT" ? `${str(obj(data.discount).value)}% · ` : ""}− ${money(obj(data.discount).amount)}`)] : []),
          ...(Number(data.pointsRedeemed) > 0 ? [fact("Points used", `${str(data.pointsRedeemed)} (− ${money(data.pointsValue)})`)] : []),
          fact("Total", money(data.total)),
          ...(str(data.paymentMethod) === "SPLIT"
            ? [
                ...(Number(data.cashPaid) > 0 ? [fact("Paid in cash", money(data.cashPaid))] : []),
                ...(Number(data.cardPaid) > 0 ? [fact("Paid by card", money(data.cardPaid))] : []),
                ...(Number(data.transferPaid) > 0 ? [fact("Paid by transfer / QR", money(data.transferPaid))] : []),
              ]
            : []),
          ...(Array.isArray(data.giftVouchers) ? (data.giftVouchers as Body[]).map((voucher) => fact("Paid by gift voucher", `${str(voucher.voucherNo)} (${str(voucher.code)}) · ${money(voucher.amount)} · ${str(voucher.kind) === "FREE" ? "free voucher" : "sold voucher"}`)) : []),
          ...(Number(data.walletUsed) > 0 ? [fact("Paid from wallet", money(data.walletUsed))] : []),
          ...(Number(data.cashPaid) > 0 ? [fact("Cash received", money(data.cashTendered ?? data.amountReceived)), fact("Change given", money(data.changeGiven))] : []),
          ...(Number(data.walletCredit) > 0 ? [fact("Change kept in wallet", money(data.walletCredit))] : []),
          ...(Number(data.walletUsed) > 0 || Number(data.walletCredit) > 0 ? [fact("Wallet balance now", money(obj(data.member).walletBalance))] : []),
        ],
      },
    };
  }

  // ── Day End: shifts ──────────────────────────────────────────────────────
  if (module === "shifts") {
    const shiftNo = str(data.shiftNo) || str(obj(obj(data.report).shift).shiftNo) || `#${resource}`;
    if (resource === "drawer-open") {
      const reason = str(data.reason) || str(obj(body).reason);
      if (!str(data.openNo)) return { action: "drawer.no_sale", category: "CASHBOOK", entityType: "drawer", summary: `Tried to open the cash drawer without a sale${reason ? ` · “${reason}”` : ""}` };
      return {
        action: "drawer.no_sale", category: "CASHBOOK", entityType: "drawer", entityId: str(data.openNo),
        summary: `Opened the cash drawer without a sale · “${reason}”`,
        details: { facts: [fact("Number", data.openNo), fact("Reason", reason), fact("Shift", data.shiftNo)] },
      };
    }
    if (resource === "open") {
      return {
        action: "shift.open", category: "CASHBOOK", entityType: "shift", entityId: str(data.shiftNo),
        summary: `Started shift ${str(data.shiftNo)} with a float of ${money(data.openingFloat)}`,
        details: { facts: [fact("Shift", data.shiftNo), fact("Opening float", money(data.openingFloat))] },
      };
    }
    if (id === "count") {
      const diff = Number(data.difference ?? 0);
      return {
        action: "shift.count", category: "CASHBOOK", entityType: "shift", entityId: resource,
        summary: `Counted the drawer: ${money(data.countedCash)} (${Math.abs(diff) < 0.01 ? "balanced" : `${diff > 0 ? "over" : "short"} by ${money(Math.abs(diff))}`})`,
        details: { facts: [fact("Counted", money(data.countedCash)), fact("Expected", money(data.expectedCash)), fact("Difference", money(diff)), ...(Number(data.recounts) > 0 ? [fact("Recount", `#${str(data.recounts)}`)] : [])] },
      };
    }
    if (id === "close") {
      const close = obj(obj(data.report).close);
      const sales = obj(obj(data.report).sales);
      const diff = Number(close.difference ?? 0);
      return {
        action: "shift.close", category: "CASHBOOK", entityType: "shift", entityId: shiftNo,
        summary: `Closed shift ${shiftNo} · sales ${money(sales.netSales)}${close.cardDifference != null && Math.abs(Number(close.cardDifference)) >= 0.01 ? ` · card machine differs ${money(Math.abs(Number(close.cardDifference)))}` : ""} · ${Math.abs(diff) < 0.01 ? "drawer balanced" : `drawer ${diff > 0 ? "over" : "short"} ${money(Math.abs(diff))}`}`,
        details: {
          facts: [
            fact("Shift", shiftNo), fact("Bills", sales.bills), fact("Net sales", money(sales.netSales)),
            fact("Cash counted", money(close.countedCash)), fact("Cash expected", money(close.expectedCash)),
            fact("Over / short", money(diff)), ...(close.differenceReason ? [fact("Reason", close.differenceReason)] : []),
            fact("Cash banked", money(close.cashBanked)), fact("Float left", money(close.floatLeft)),
            ...(Number(sales.cardSales) > 0 ? [fact("Card sales", money(sales.cardSales)), fact("Card machine slip", close.cardSlipTotal == null ? "Not settled yet" : money(close.cardSlipTotal))] : []),
            ...(close.cardDifferenceReason ? [fact("Card note", close.cardDifferenceReason)] : []),
            ...(Number(sales.transferSales) > 0 ? [fact("Transfer / QR sales", money(sales.transferSales))] : []),
            ...shelfCountFacts(close.stockCount),
          ],
        },
      };
    }
  }

  // ── Goods received (GRN) ─────────────────────────────────────────────────
  if (module === "grns" && method === "POST") {
    const items = Array.isArray(data.items) ? (data.items as Body[]) : [];
    const no = str(data.grnNo);
    if (!no) return { action: "grn.create", category: "GOODS", entityType: "GRN", summary: "Tried to record goods received" };
    const rejected = Number(data.rejectedUnits ?? 0);
    const free = Number(data.freeUnits ?? 0);
    return {
      action: "grn.create", category: "GOODS", entityType: "GRN", entityId: no,
      summary: `Received goods ${no} from ${str(data.supplierName)} at ${str(obj(data.branch).name)}: ${str(data.acceptedUnits)} unit(s) · ${money(data.totalCost)}${data.poNumber ? ` · ${str(data.poNumber)}` : ""}${data.supplierInvoiceNo ? ` · invoice ${str(data.supplierInvoiceNo)}` : ""}${rejected ? ` · ${rejected} rejected` : ""}${free ? ` · ${free} FREE issue (worth ${money(data.freeValue)})` : ""}`,
      details: {
        facts: [
          fact("Supplier", data.supplierName), fact("Branch", obj(data.branch).name),
          ...(data.poNumber ? [fact("Purchase order", data.poNumber)] : []),
          ...(data.supplierInvoiceNo ? [fact("Supplier invoice", data.supplierInvoiceNo)] : []),
          ...(data.invoiceTotal != null ? [fact("Invoice total", money(data.invoiceTotal))] : []),
          fact("Accepted value", money(data.totalCost)),
          ...(free ? [fact("Free issue", `${free} bottle(s), worth ${money(data.freeValue)} at cost — spread over the cost price`)] : []),
          ...items.map((item) => fact(str(item.description), `${str(item.acceptedQty)} accepted${Number(item.freeQty) ? ` + ${str(item.freeQty)} free` : ""}${Number(item.rejectedQty) ? ` · ${str(item.rejectedQty)} rejected (${str(item.rejectReason)})` : ""} × ${money(item.unitCost)}`)),
        ],
      },
    };
  }

  // ── Branch transfers (GTN) ───────────────────────────────────────────────
  if (module === "gtns" && method === "POST") {
    const items = Array.isArray(data.items) ? (data.items as Body[]) : [];
    const no = str(data.gtnNo) || str(prior.gtnNo);
    const from = str(obj(data.fromBranch).name);
    const to = str(obj(data.toBranch).name);
    const what = items.map((item) => `${str(item.sentQty)} × ${str(item.productName)}`).join(", ");
    if (!no) return { action: `gtn.${id ?? "send"}`, category: "GOODS", entityType: "GTN", summary: "Tried to record a branch transfer" };
    if (id === "receive") {
      const totals = obj(data.totals);
      return {
        action: "gtn.receive", category: "GOODS", entityType: "GTN", entityId: no,
        summary: `Received transfer ${no} from ${from} at ${to}: ${str(totals.received)} good${Number(totals.damaged) ? ` · ${str(totals.damaged)} damaged` : ""}${Number(totals.missing) ? ` · ${str(totals.missing)} MISSING` : ""} of ${str(totals.sent)} sent`,
        details: { facts: [...items.map((item) => fact(str(item.productName), `${str(item.receivedQty)} good · ${str(item.damagedQty)} damaged · ${str(item.missingQty)} missing (of ${str(item.sentQty)})`)), ...(data.receiveNote ? [fact("Note", data.receiveNote)] : [])] },
      };
    }
    if (id === "cancel") {
      return {
        action: "gtn.cancel", category: "GOODS", entityType: "GTN", entityId: no,
        summary: `Cancelled transfer ${no} (${from} → ${to}): stock back at ${from} — ${str(data.cancelReason)}`,
        details: { facts: [fact("Reason", data.cancelReason), ...items.map((item) => fact(str(item.productName), `${str(item.sentQty)} back on the shelf`))] },
      };
    }
    return {
      action: "gtn.send", category: "GOODS", entityType: "GTN", entityId: no,
      summary: `Sent ${what} from ${from} to ${to} on ${no}${data.carriedBy ? ` (carried by ${str(data.carriedBy)})` : ""}`,
      details: { facts: [fact("From", from), fact("To", to), ...(data.carriedBy ? [fact("Carried by", data.carriedBy)] : []), ...items.map((item) => fact(str(item.productName), `${str(item.sentQty)} sent`)), ...(data.notes ? [fact("Note", data.notes)] : [])] },
    };
  }

  // ── Branches ─────────────────────────────────────────────────────────────
  if (module === "branches") {
    if (resource === "switch") {
      const branch = obj(obj(data).branch);
      return { action: "branch.switch", category: "BRANCH", entityType: "branch", entityId: str(branch.code), summary: `Switched to working at ${str(branch.name) || "another branch"}` };
    }
    const name = str(data.name) || str(body.name) || "a branch";
    if (method === "POST") {
      return { action: "branch.create", category: "BRANCH", entityType: "branch", entityId: str(data.code), summary: `Added branch ${name} (${str(data.code)})`, details: { facts: [fact("Code", data.code), ...(data.address ? [fact("Address", data.address)] : []), ...(data.phone ? [fact("Phone", data.phone)] : [])] } };
    }
    if (method === "PATCH") {
      return {
        action: body.isActive === false ? "branch.close" : body.isActive === true ? "branch.reopen" : "branch.update",
        category: "BRANCH", entityType: "branch", entityId: str(data.code),
        summary: body.isActive === false ? `Closed branch ${name}` : body.isActive === true ? `Reopened branch ${name}` : `Updated branch ${name}`,
        details: { facts: Object.keys(body).map((key) => fact(key, body[key])) },
      };
    }
  }

  // ── Returns & damages ────────────────────────────────────────────────────
  // ── Gift vouchers ────────────────────────────────────────────────────────
  if (module === "gift-vouchers" && method === "POST") {
    if (!resource) {
      const vouchers = Array.isArray(data.vouchers) ? (data.vouchers as Body[]) : [];
      if (!vouchers.length) return { action: "voucher.create", category: "VOUCHER", entityType: "gift voucher", summary: `Tried to create ${str(obj(body).kind) === "FREE" ? "free" : "sold"} gift voucher(s) of ${money(obj(body).amount)}` };
      const numbers = vouchers.map((voucher) => str(voucher.voucherNo));
      const sold = str(data.kind) === "SOLD";
      return {
        action: "voucher.create", category: "VOUCHER", entityType: "gift voucher", entityId: numbers.length === 1 ? numbers[0] : `${numbers[0]}…${numbers[numbers.length - 1]}`,
        summary: `Issued ${vouchers.length} ${sold ? "sold" : "FREE"} gift voucher${vouchers.length === 1 ? "" : "s"} of ${money(data.amount)}${vouchers.length > 1 ? ` (total ${money(data.total)})` : ""}${sold ? ` · paid by ${payment(data.paymentMethod)}` : ""}${str(vouchers[0].issuedTo) ? ` · for ${str(vouchers[0].issuedTo)}` : ""}`,
        details: {
          facts: [
            fact("Vouchers", numbers.join(", ")),
            fact("Each worth", money(data.amount)),
            fact("Type", sold ? "Sold (customer paid — owed until used)" : "Free (promotion cost when used)"),
            ...(sold ? [fact("Paid by", payment(data.paymentMethod)), fact("Shift", data.shiftNo)] : []),
            ...(str(vouchers[0].issuedTo) ? [fact("Given to", `${str(vouchers[0].issuedTo)}${str(vouchers[0].issuedPhone) ? ` (${str(vouchers[0].issuedPhone)})` : ""}`)] : []),
            ...(vouchers[0].expiresAt ? [fact("Expires", new Date(vouchers[0].expiresAt as string).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" }))] : []),
            ...(str(vouchers[0].note) ? [fact("Note", vouchers[0].note)] : []),
          ],
        },
      };
    }
    if (id === "cancel") {
      if (!str(data.voucherNo)) return { action: "voucher.cancel", category: "VOUCHER", entityType: "gift voucher", summary: `Tried to cancel a gift voucher${str(obj(body).reason) ? ` · “${str(obj(body).reason)}”` : ""}` };
      return {
        action: "voucher.cancel", category: "VOUCHER", entityType: "gift voucher", entityId: str(data.voucherNo),
        summary: `Cancelled gift voucher ${str(data.voucherNo)} (${money(data.amount)}) · “${str(data.cancelReason)}”`,
        details: { facts: [fact("Voucher", data.voucherNo), fact("Amount", money(data.amount)), fact("Type", str(data.kind) === "FREE" ? "Free" : "Sold"), fact("Reason", data.cancelReason)] },
      };
    }
  }

  if (module === "returns" && method === "POST") {
    const lines = Array.isArray(data.lines) ? (data.lines as Body[]) : [];
    const what = lines.map((line) => `${str(line.quantity)} × ${str(line.product)}`).join(", ");
    const no = str(data.returnNo);
    // Blocked attempts have no result to describe.
    if (!no) {
      const attempt = { refund: "take back bottles and refund", exchange: "exchange a damaged bottle", damage: "mark stock as damaged", clear: "clear damaged stock" }[resource] ?? "record a return";
      return { action: `return.${resource}`, category: "RETURN", entityType: "return", summary: `Tried to ${attempt}` };
    }
    const common =[fact("Number", no), ...lines.map((line) => fact(str(line.product), `${str(line.quantity)} bottle(s)`)), fact("Reason", data.reason), ...(data.note ? [fact("Note", data.note)] : [])];
    if (resource === "refund") {
      const toWallet = str(data.refundMethod) === "WALLET";
      const kept = lines.filter((line) => str(line.condition) === "DAMAGED").reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
      return {
        action: "return.refund", category: "RETURN", entityType: "return", entityId: no,
        summary: `Took back ${what} from bill ${str(data.billNo)} and paid back ${money(data.refund)} ${toWallet ? `into ${str(data.customer)}'s wallet` : "in cash"}${Number(data.pointsReversed) > 0 ? ` · ${str(data.pointsReversed)} points taken back` : ""}${kept ? ` · ${kept} kept aside as damaged` : ""} — ${str(data.reason)}`,
        details: { facts: [fact("Bill", data.billNo), ...(data.customer ? [fact("Member", data.customer)] : []), fact("Paid back", `${money(data.refund)} ${toWallet ? "into the wallet" : "in cash from the drawer"}`), ...(Number(data.pointsReversed) > 0 ? [fact("Points taken back", data.pointsReversed)] : []), ...common] },
      };
    }
    if (resource === "exchange") {
      return {
        action: "return.exchange", category: "RETURN", entityType: "return", entityId: no,
        summary: `Exchanged damaged ${what} for new bottle(s)${data.billNo ? ` (bill ${str(data.billNo)})` : ""}${data.customer ? ` · ${str(data.customer)}` : ""} — ${str(data.reason)}`,
        details: { facts: [...(data.billNo ? [fact("Bill", data.billNo)] : []), ...(data.customer ? [fact("Customer", `${str(data.customer)}${data.mobile ? ` · ${str(data.mobile)}` : ""}`)] : []), ...common] },
      };
    }
    if (resource === "damage") {
      return {
        action: "return.store_damage", category: "RETURN", entityType: "return", entityId: no,
        summary: `Marked ${what} as damaged in store and kept aside — ${str(data.reason)}`,
        details: { facts: common },
      };
    }
    if (resource === "clear") {
      return {
        action: "return.clear", category: "RETURN", entityType: "return", entityId: no,
        summary: `Cleared damaged stock: ${what} — ${str(data.disposalLabel).toLowerCase()}${data.reference ? ` (${str(data.reference)})` : ""} — ${str(data.reason)}`,
        details: { facts: [fact("What happened", data.disposalLabel), ...(data.reference ? [fact("Reference", data.reference)] : []), ...common] },
      };
    }
  }

  // ── Cash book: receipts (money in) & vouchers (money out) ────────────────
  // ── Purchase orders ──────────────────────────────────────────────────────
  if (module === "purchase-orders") {
    const po = str(data.poNumber) || str(prior.poNumber) || "purchase order";
    const supplier = str(obj(data.supplier).name) || str(obj(prior.supplier).name);
    const items = Array.isArray(data.items) ? (data.items as Body[]) : [];
    const itemFacts = items.map((item) => fact(str(item.description), `${str(item.quantity)} × ${money(item.unitCost)} = ${money(item.lineTotal)}`));
    if (method === "POST" && !resource) {
      return {
        action: "purchase.create", category: "PURCHASE", entityType: "purchase order", entityId: po,
        summary: `Created purchase order ${po} for ${supplier} · ${items.length} item(s) · ${money(data.total)}`,
        details: { facts: [fact("Supplier", supplier), fact("Total", money(data.total)), ...(data.expectedDate ? [fact("Deliver by", str(data.expectedDate).slice(0, 10))] : []), ...itemFacts] },
      };
    }
    if (method === "PATCH") {
      return {
        action: "purchase.update", category: "PURCHASE", entityType: "purchase order", entityId: po,
        summary: `Changed draft purchase order ${po} (${supplier}) · now ${money(data.total)}`,
        details: { changes: prior.total !== undefined && prior.total !== data.total ? [{ label: "Total", before: money(prior.total), after: money(data.total) }] : [], facts: itemFacts },
      };
    }
    if (id === "send" && obj(response).success === false) {
      return {
        action: "purchase.email_failed", category: "PURCHASE", entityType: "purchase order", entityId: po,
        summary: `Email of purchase order ${po} to ${supplier || "the supplier"} (${str(body.to)}) FAILED — ${str(obj(response).message)}`,
        details: { facts: [fact("To", body.to), ...(body.cc ? [fact("Copy to", body.cc)] : []), fact("Subject", body.subject), fact("Result", "Not sent"), fact("Reason", obj(response).message)] },
      };
    }
    if (id === "send") {
      return {
        action: "purchase.email", category: "PURCHASE", entityType: "purchase order", entityId: po,
        summary: `Emailed purchase order ${po} to ${supplier} (${str(body.to)})`,
        details: { facts: [fact("To", body.to), ...(body.cc ? [fact("Copy to", body.cc)] : []), fact("Subject", body.subject), fact("Total", money(data.total))] },
      };
    }
    if (id === "receive") {
      const lines = Array.isArray(body.lines) ? (body.lines as Body[]).filter((line) => Number(line.quantity) > 0) : [];
      const byId = new Map(items.map((item) => [Number(item.id), item]));
      return {
        action: "purchase.receive", category: "PURCHASE", entityType: "purchase order", entityId: po,
        summary: `Received stock for ${po} (${supplier}): ${lines.map((line) => `${str(line.quantity)} × ${str(byId.get(Number(line.itemId))?.description)}`).join(", ")} · ${str(data.statusLabel)}`,
        details: { facts: lines.map((line) => fact(str(byId.get(Number(line.itemId))?.description), `${str(line.quantity)} received`)) },
      };
    }
    if (id === "cancel") {
      return {
        action: "purchase.cancel", category: "PURCHASE", entityType: "purchase order", entityId: po,
        summary: `Cancelled purchase order ${po} (${supplier}) — ${str(body.reason)}`,
        details: { facts: [fact("Reason", body.reason), fact("Total", money(data.total))] },
      };
    }
  }

  if (module === "cash-book") {
    const isOut = str(data.direction || body.direction) === "OUT";
    const label = (isOut ? EXPENSE_LABELS : INCOME_LABELS)[str(data.category || body.category)] ?? str(data.category || body.category);
    const sourceText = { DRAWER: "the cash drawer", BANK: "the bank", OWNER: "the owner" }[str(data.source || body.source)] ?? str(data.source || body.source);
    if (resource === "bank") {
      const list = Array.isArray(data.entries) ? (data.entries as Array<Record<string, unknown>>) : [];
      return {
        action: "cashbook.bank", category: "CASHBOOK", entityType: "deposit", entityId: str(data.reference) || null,
        summary: `Marked ${list.length || str(data.count)} entr${(list.length || Number(data.count)) === 1 ? "y" : "ies"} as banked · ${money(data.amount)}${data.reference ? ` · slip ${str(data.reference)}` : ""}`,
        details: {
          facts: [
            fact("Amount", money(data.amount)), ...(data.reference ? [fact("Deposit slip / reference", data.reference)] : []), ...(body.date ? [fact("Banked on", body.date)] : []),
            ...list.map((entry) => fact(`${str(entry.entryNo)} · ${str(entry.categoryLabel)}`, money(entry.amount))),
          ],
        },
      };
    }
    if (resource && id === "unbank") {
      return {
        action: "cashbook.unbank", category: "CASHBOOK", entityType: "cash entry", entityId: resource,
        summary: `Undid "banked" on ${str(data.entryNo)} (${label} ${money(data.amount)}) — back to waiting`,
        details: { facts: [fact("Entry", data.entryNo), fact("Amount", money(data.amount))] },
      };
    }
    if (resource && id === "void") {
      return {
        action: "cashbook.void", category: "CASHBOOK", entityType: "cash entry", entityId: resource,
        summary: `Voided ${str(data.entryNo) || `entry #${resource}`}${data.amount != null ? ` (${label} ${money(data.amount)})` : ""} — ${str(body.reason)}`,
        details: { facts: [fact("Entry", data.entryNo), fact("Amount", money(data.amount)), fact("Reason", body.reason)] },
      };
    }
    return {
      action: isOut ? "cashbook.expense" : "cashbook.receipt", category: "CASHBOOK", entityType: isOut ? "voucher" : "receipt", entityId: str(data.entryNo),
      summary: isOut
        ? `Recorded expense${data.entryNo ? ` ${str(data.entryNo)}` : ""}: ${label} ${money(data.amount ?? body.amount)} from ${sourceText}${data.party || body.party ? ` — paid to ${str(data.party || body.party)}` : ""}`
        : `Recorded money in${data.entryNo ? ` ${str(data.entryNo)}` : ""}: ${label} ${money(data.amount ?? body.amount)} into ${sourceText}${data.party || body.party ? ` — from ${str(data.party || body.party)}` : ""}`,
      details: {
        facts: [
          fact(isOut ? "Voucher" : "Receipt", data.entryNo), fact("Category", label), fact("Amount", money(data.amount ?? body.amount)),
          fact(isOut ? "Paid from" : "Paid into", sourceText), ...(data.party || body.party ? [fact(isOut ? "Paid to" : "Received from", data.party || body.party)] : []),
          ...(data.reference || body.reference ? [fact("Bill / reference", data.reference || body.reference)] : []),
          ...(data.note || body.note ? [fact("Note", data.note || body.note)] : []),
        ],
      },
    };
  }

  // ── Bulk price change (e.g. government excise change) ─────────────────────
  if (module === "inventory-management" && resource === "products" && id === "bulk-price") {
    const changes = Array.isArray(data.changes) ? (data.changes as Body[]) : [];
    return {
      action: "product.bulk_price", category: "PRODUCT", entityType: "price change", entityId: null,
      summary: `Changed the selling price of ${str(data.count) || changes.length} product(s) — ${str(data.reason || body.reason)}`,
      details: {
        facts: [fact("Reason", data.reason || body.reason), fact("Products changed", data.count)],
        changes: changes.map((change) => ({ label: str(change.name), before: money(change.before), after: money(change.after) })),
      },
    };
  }

  // ── Products, stock & photos ─────────────────────────────────────────────
  if (module === "inventory-management" && resource === "products") {
    const name = str(data.name) || str(prior.name) || str(body.name) || "a product";

    if (method === "POST" && !id) {
      return {
        action: "product.create", category: "PRODUCT", entityType: "product", entityId: data.id as number,
        summary: `Added new product ${name} with ${str(data.quantity)} in stock`,
        details: {
          facts: [
            fact("Product", name),
            fact("Brand", nameOf(data.brand)),
            fact("Category", nameOf(data.category)),
            fact("Barcode", str(data.partNumber) || "None"),
            fact("Opening stock", `${str(data.quantity)} units`),
            fact("Selling price", money(data.sellingPrice)),
            fact("Empty bottle price", Number(data.emptyBottlePrice) > 0 ? money(data.emptyBottlePrice) : "Not returnable"),
            fact("Product ID", data.displayId),
          ],
        },
      };
    }
    if (sub === "restock") {
      const after = Number(data.quantity);
      const added = Number(body.quantity);
      return {
        action: "stock.restock", category: "STOCK", entityType: "product", entityId: id,
        summary: `Added ${added} × ${name} to stock`,
        details: {
          facts: [
            fact("Product", name),
            fact("Units added", added),
            ...(body.purchasePrice != null ? [fact("Cost paid", money(body.purchasePrice))] : []),
          ],
          ...(Number.isFinite(after) ? { changes: [{ label: "Stock", before: `${after - added} units`, after: `${after} units` }] } : {}),
        },
      };
    }
    if (sub === "empties" && subId === "return") {
      return {
        action: "stock.empties_returned", category: "STOCK", entityType: "product", entityId: id,
        summary: `Gave ${str(body.quantity)} empty ${name} bottle${Number(body.quantity) === 1 ? "" : "s"} back to the supplier`,
        details: {
          facts: [fact("Product", name), fact("Empty bottles returned", body.quantity)],
          ...(data.emptyBottlesOnHand != null
            ? { changes: [{ label: "Empty bottles in the shop", before: str(Number(data.emptyBottlesOnHand) + Number(body.quantity)), after: str(data.emptyBottlesOnHand) }] }
            : {}),
        },
      };
    }
    if (sub === "sell") {
      return {
        action: "stock.manual_sale", category: "STOCK", entityType: "product", entityId: id,
        summary: `Marked ${str(body.quantity)} × ${name} as sold`,
        details: { facts: [fact("Product", name), fact("Units", body.quantity)] },
      };
    }
    if (sub === "images") {
      const count = Array.isArray(responseData) ? responseData.length : 0;
      const summary = method === "DELETE"
        ? `Removed a photo from ${name}`
        : subAction === "primary"
          ? `Changed the main photo of ${name}`
          : `Added ${count || "new"} photo${count === 1 ? "" : "s"} to ${name}`;
      return { action: "product.photos", category: "PRODUCT", entityType: "product", entityId: id, summary, details: { facts: [fact("Product", name)] } };
    }
    if (method === "PATCH") {
      const changes = before && Object.keys(data).length > 0 ? productChanges(prior, data) : [];
      return {
        action: "product.update", category: "PRODUCT", entityType: "product", entityId: id,
        summary: changes.length === 0 && before && Object.keys(data).length > 0 ? `Saved ${name} with no changes` : `Updated ${name}: ${changeSummary(changes)}`,
        details: { facts: [fact("Product", name)], changes },
      };
    }
    if (method === "DELETE") {
      return {
        action: "product.delete", category: "PRODUCT", entityType: "product", entityId: id,
        summary: `Deleted product ${name}`,
        details: { facts: [fact("Product", name), fact("Stock at the time", prior.quantity != null ? `${str(prior.quantity)} units` : "")] },
      };
    }
  }

  // ── Staff ────────────────────────────────────────────────────────────────
  if (module === "auth" && resource === "staff") {
    const name = str(data.name) || str(prior.name) || str(body.name) || "a staff member";
    if (method === "POST") {
      return {
        action: "staff.create", category: "STAFF", entityType: "staff", entityId: data.id as number,
        summary: `Created a ${role(data.role)} account for ${name}`,
        details: { facts: [fact("Name", name), fact("Email", data.email), fact("Role", role(data.role))] },
      };
    }
    const shows: Array<[string, (staff: Body) => string]> = [
      ["Name", (s) => str(s.name)],
      ["Email", (s) => str(s.email)],
      ["Role", (s) => role(s.role)],
      ["Account", (s) => (s.isActive === false ? "Disabled" : "Active")],
    ];
    const changes = before && Object.keys(data).length > 0
      ? shows.map(([label, show]) => ({ label, before: show(prior), after: show(data) })).filter((c) => c.before !== c.after)
      : [];
    if (body.password) changes.push({ label: "Password", before: "••••••", after: "Changed" });
    return {
      action: "staff.update", category: "STAFF", entityType: "staff", entityId: id,
      summary: `Updated ${name}'s account${changes.length ? `: ${changes.map((c) => (c.label === "Password" ? "password changed" : `${c.label.toLowerCase()} ${c.before} → ${c.after}`)).join(", ")}` : ""}`,
      details: { facts: [fact("Staff member", name)], changes },
    };
  }

  // ── Customers, purchases, settlements ────────────────────────────────────
  if (module === "user-management") {
    if (resource === "purchases" || sub === "purchases") {
      const settling = segments.includes("settle");
      return {
        action: settling ? "sale.settlement" : "sale.purchase",
        category: "SALE",
        entityType: "purchase",
        entityId: subId ?? id ?? (data.id as number),
        summary: settling ? `Took a payment of ${money(body.amount)} on an invoice` : `${VERBS[method] ?? "Changed"} a customer purchase`,
        details: {
          facts: settling
            ? [fact("Amount", money(body.amount)), fact("Payment", payment(body.paymentMethod ?? "CASH"))]
            : [fact("Invoice", data.invoiceGroupCode), fact("Amount", money(data.finalSellingPrice))],
        },
      };
    }
    if (RESOURCE_LABELS[resource]) {
      const [label, category] = RESOURCE_LABELS[resource];
      return { action: `${label.replace(/ /g, "_")}.${method.toLowerCase()}`, category, entityType: label, entityId: id ?? (data.id as number), summary: `${VERBS[method] ?? "Changed"} ${label}` };
    }
    const customer = [str(data.firstName || prior.firstName), str(data.lastName || prior.lastName)].filter(Boolean).join(" ");
    return {
      action: `customer.${method.toLowerCase()}`, category: "CUSTOMER", entityType: "customer", entityId: resource ?? (data.id as number),
      summary: `${VERBS[method] ?? "Changed"} customer${customer ? ` ${customer}` : ""}`,
      details: { facts: [fact("Customer", customer), fact("Mobile", data.mobileNumber)] },
    };
  }

  // ── Accounts (receipts, vouchers, deposits…) ─────────────────────────────
  if (module === "accounts") {
    const [label] = RESOURCE_LABELS[resource] ?? [resource, "ACCOUNTS"];
    const ref = str(data.receiptNo) || str(data.voucherNo) || str(data.depositNo) || str(data.code);
    const verb = sub ? sub.replace(/-/g, " ") : (VERBS[method] ?? "changed").toLowerCase();
    const amount = data.amount ?? data.totalAmount;
    return {
      action: `${label.replace(/ /g, "_")}.${sub ?? method.toLowerCase()}`,
      category: "ACCOUNTS",
      entityType: label,
      entityId: id ?? (data.id as number),
      summary: `${capitalise(verb)} ${label}${ref ? ` ${ref}` : ""}${typeof amount === "number" ? ` · ${money(amount)}` : ""}`,
      details: {
        facts: [
          ...(ref ? [fact("Number", ref)] : []),
          ...(typeof amount === "number" ? [fact("Amount", money(amount))] : []),
          ...(obj(data.account).name ? [fact("Account", nameOf(data.account))] : []),
          ...(data.paymentMethod ? [fact("Payment", payment(data.paymentMethod))] : []),
          ...(data.description ? [fact("Description", data.description)] : []),
        ],
      },
    };
  }

  // ── Brands, categories, suppliers and anything else ──────────────────────
  // ── Shop settings: exactly which values changed ─────────────────────────────
  if (module === "settings" && method === "PATCH") {
    const changes = Object.entries(SETTING_LABELS)
      .filter(([key]) => key in body && showSetting(key, prior[key]) !== showSetting(key, data[key]))
      .map(([key, label]) => ({ label, before: showSetting(key, prior[key]), after: showSetting(key, data[key]) }));
    return {
      action: "settings.update", category: "OTHER", entityType: "shop settings", entityId: null,
      summary: changes.length ? `Changed shop settings: ${changes.map((change) => `${change.label} ${change.before} → ${change.after}`).join(" · ")}` : "Saved shop settings (no values changed)",
      details: { changes },
    };
  }

  // ── Suppliers: details on add, what changed on edit ─────────────────────────
  if (module === "inventory-management" && resource === "suppliers") {
    const name = str(data.name) || str(prior.name) || str(body.name) || "a supplier";
    if (method === "POST") {
      return {
        action: "supplier.create", category: "STOCK", entityType: "supplier", entityId: data.id as number,
        summary: `Added supplier ${name}${data.email ? ` (${str(data.email)})` : ""}`,
        details: { facts: SUPPLIER_FIELDS.map(([key, label]) => fact(label, data[key])).filter((row) => row.value !== "—") },
      };
    }
    if (method === "PATCH") {
      const changes = SUPPLIER_FIELDS
        .map(([key, label]) => ({ label, before: str(prior[key]) || "None", after: str(data[key]) || "None" }))
        .filter((change) => change.before !== change.after);
      return {
        action: "supplier.update", category: "STOCK", entityType: "supplier", entityId: id,
        summary: changes.length ? `Updated supplier ${name}: ${changes.map((change) => change.label.toLowerCase()).join(", ")}` : `Saved supplier ${name} (no changes)`,
        details: { changes },
      };
    }
    if (method === "DELETE") {
      return { action: "supplier.delete", category: "STOCK", entityType: "supplier", entityId: id, summary: `Deleted supplier ${name}`, details: { facts: [fact("Supplier", name)] } };
    }
  }

  const [label, category] = RESOURCE_LABELS[resource] ?? RESOURCE_LABELS[module] ?? [resource ?? module, "OTHER" as ActivityCategory];
  const newName = str(data.name) || str(body.name);
  const oldName = str(prior.name);
  if (method === "PATCH" && oldName && newName && oldName !== newName) {
    return {
      action: `${label.replace(/ /g, "_")}.patch`, category, entityType: label, entityId: id,
      summary: `Renamed ${label} ${oldName} → ${newName}`,
      details: { changes: [{ label: "Name", before: oldName, after: newName }] },
    };
  }
  const shownName = newName || oldName;
  return {
    action: `${label.replace(/ /g, "_")}.${method.toLowerCase()}`,
    category,
    entityType: label,
    entityId: id ?? (data.id as number),
    summary: `${VERBS[method] ?? "Changed"} ${label}${shownName ? ` ${shownName}` : ""}`,
    details: shownName ? { facts: [fact(capitalise(label), shownName), ...(data.code ? [fact("Code", data.code)] : [])] } : undefined,
  };
}
