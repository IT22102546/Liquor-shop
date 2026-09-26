import type { ActivityCategory } from "./activity-log.service";

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
const PAYMENT_NAMES: Record<string, string> = { CASH: "Cash", BANK_TRANSFER: "Card / Transfer", CHEQUE: "Cheque" };
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
      summary: `Sold ${soldText || `${itemCount} items`} for ${money(data.total)} · ${payment(data.paymentMethod)}${empties > 0 ? ` · ${empties} empt${empties === 1 ? "y" : "ies"} returned` : ""}${member.name ? ` · ${str(member.name)}` : ""}${obj(data.discount).amount ? ` · discount −${money(obj(data.discount).amount)}` : ""}${Number(data.pointsRedeemed) > 0 ? ` · ${str(data.pointsRedeemed)} points used` : ""}`,
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
          fact("Customer", member.name ? `${str(member.name)} (loyalty member)` : "Walk-in customer"),
          ...(member.name ? [fact("Points earned", `${str(member.pointsEarned)} (balance ${str(member.pointsBalance)})`)] : []),
          fact("Payment", payment(data.paymentMethod)),
          ...(empties > 0 ? [fact("Subtotal", money(data.subtotal)), fact("Empty bottles returned", `${empties} (− ${money(data.emptyDeduction)})`)] : []),
          ...(obj(data.discount).amount ? [fact("Discount", `${obj(data.discount).type === "PERCENT" ? `${str(obj(data.discount).value)}% · ` : ""}− ${money(obj(data.discount).amount)}`)] : []),
          ...(Number(data.pointsRedeemed) > 0 ? [fact("Points used", `${str(data.pointsRedeemed)} (− ${money(data.pointsValue)})`)] : []),
          fact("Total", money(data.total)),
          ...(str(data.paymentMethod) === "CASH" ? [fact("Cash received", money(data.amountReceived)), fact("Change given", money(data.changeGiven))] : []),
        ],
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
