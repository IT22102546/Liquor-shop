import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { emailConfigured, sendEmail, senderAddress } from "../../common/utils/mailer";
import { getSettings, type ShopSettings } from "../settings/settings.service";
import { createGrn } from "../goods/grn.service";

/**
 * Purchase orders to suppliers. DRAFT → SENT (emailed) → PARTIAL / RECEIVED, or CANCELLED.
 * Nothing is deleted: every order, change, email attempt and receipt stays on record.
 */

export type PurchaseOrderStatus = "DRAFT" | "SENT" | "PARTIAL" | "RECEIVED" | "CANCELLED";
export const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIAL: "Part received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export type OrderItemInput = { productId?: number | null; description?: string; quantity: number; unitCost: number; freeQty?: number };
export type OrderInput = { supplierId: number; branchId?: number | null; expectedDate?: string | null; notes?: string | null; items: OrderItemInput[] };
/** The branch the person is working in (from requestBranch). */
export type OrderingBranch = { id: number; name: string; isMain: boolean };

/**
 * Which branch an order is for. From the main branch an admin can order for any open branch;
 * from another branch, orders are only for that branch.
 */
async function orderBranch(requested: number | null | undefined, working: OrderingBranch) {
  const target = requested ?? working.id;
  if (target !== working.id && !working.isMain) {
    throw AppError.validation({ branchId: [`From ${working.name} you can only order for ${working.name}. Switch to the main branch to order for other branches.`] });
  }
  const branch = await prisma.branch.findFirst({ where: { id: target, isActive: true }, select: { id: true } });
  if (!branch) throw AppError.validation({ branchId: ["Choose an open branch"] });
  return branch.id;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const rupees = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const dateText = (date: Date | null | undefined) => (date ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

async function staffNames(ids: Array<number | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is number => Boolean(id)))];
  const staff = await prisma.posAdmin.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(staff.map((member) => [member.id, member.name]));
}

/** Resolves each line: product name and size as ordered, quantity, cost and line total. */
async function buildItems(items: OrderItemInput[]) {
  if (items.length === 0) throw AppError.validation({ items: ["Add at least one item"] });
  const ids = [...new Set(items.map((item) => item.productId).filter((id): id is number => Boolean(id)))];
  const products = await prisma.inventoryProduct.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, compatibleWith: true } });
  const byId = new Map(products.map((product) => [product.id, product]));
  return items.map((item, index) => {
    const product = item.productId ? byId.get(item.productId) : undefined;
    if (item.productId && !product) throw AppError.validation({ items: [`Line ${index + 1}: that product no longer exists`] });
    const description = item.description?.trim() || (product ? [product.name, product.compatibleWith].filter(Boolean).join(" · ") : "");
    if (!description) throw AppError.validation({ items: [`Line ${index + 1}: choose a product or describe the item`] });
    return {
      productId: product?.id ?? null,
      description,
      quantity: item.quantity,
      // Free issue agreed with the supplier (not charged).
      freeQty: Math.max(0, Math.floor(item.freeQty ?? 0)),
      unitCost: round2(item.unitCost),
      lineTotal: round2(item.quantity * item.unitCost),
    };
  });
}

async function assertSupplier(supplierId: number) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw AppError.validation({ supplierId: ["Choose a supplier"] });
  return supplier;
}

export async function createOrder(dto: OrderInput, actorId: number, working: OrderingBranch) {
  const branchId = await orderBranch(dto.branchId, working);
  await assertSupplier(dto.supplierId);
  const items = await buildItems(dto.items);
  const total = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const count = await prisma.purchaseOrder.count();
      const order = await prisma.purchaseOrder.create({
        data: {
          poNumber: `PO-${String(count + 1 + attempt).padStart(5, "0")}`,
          supplierId: dto.supplierId,
          expectedDate: dto.expectedDate ? new Date(`${dto.expectedDate}T12:00:00`) : null,
          notes: dto.notes?.trim() || null,
          total,
          createdById: actorId,
          // Delivered to the branch it was ordered for; received there on a GRN.
          branchId,
          items: { create: items },
        },
      });
      return getOrder(order.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new AppError("Could not number the purchase order — please try again", 409);
}

/** Drafts can be changed freely. Once sent, the supplier has the order: cancel it and raise a new one instead. */
export async function updateOrder(id: number, dto: OrderInput, working: OrderingBranch) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!order) throw AppError.notFound("Purchase order not found");
  if (order.status !== "DRAFT") throw new AppError(`${order.poNumber} has been ${STATUS_LABELS[order.status as PurchaseOrderStatus].toLowerCase()} and can't be changed. Cancel it and create a new order instead.`, 400);
  // Same rule as a new order: another branch's draft can only be changed from the main branch.
  const branchId = await orderBranch(dto.branchId ?? order.branchId, working);
  await assertSupplier(dto.supplierId);
  const items = await buildItems(dto.items);
  await prisma.$transaction([
    prisma.purchaseOrderItem.deleteMany({ where: { orderId: id } }),
    prisma.purchaseOrder.update({
      where: { id },
      data: {
        supplierId: dto.supplierId,
        branchId,
        expectedDate: dto.expectedDate ? new Date(`${dto.expectedDate}T12:00:00`) : null,
        notes: dto.notes?.trim() || null,
        total: round2(items.reduce((sum, item) => sum + item.lineTotal, 0)),
        items: { create: items },
      },
    }),
  ]);
  return getOrder(id);
}

export async function getOrder(id: number) {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { orderBy: { id: "asc" }, include: { product: { select: { id: true, name: true, quantity: true, partNumber: true } } } },
      emails: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) throw AppError.notFound("Purchase order not found");
  const names = await staffNames([order.createdById, order.sentById, order.receivedById, order.cancelledById, ...order.emails.map((email) => email.sentById)]);
  const settings = await getSettings();
  const [deliverTo, grns] = await Promise.all([
    order.branchId ? prisma.branch.findUnique({ where: { id: order.branchId }, select: { id: true, name: true, code: true, address: true, phone: true, email: true, isMain: true } }) : null,
    prisma.grn.findMany({ where: { purchaseOrderId: order.id }, orderBy: { createdAt: "asc" }, select: { id: true, grnNo: true, createdAt: true, supplierInvoiceNo: true, acceptedUnits: true, rejectedUnits: true, totalCost: true } }),
  ]);
  const contact = orderContact(deliverTo, settings);
  return {
    ...order,
    deliverTo,
    /** Who the order is from, as printed and emailed: the branch's details, else the shop's. */
    contact,
    grns,
    statusLabel: STATUS_LABELS[order.status as PurchaseOrderStatus] ?? order.status,
    createdBy: names.get(order.createdById) ?? "—",
    sentBy: order.sentById ? names.get(order.sentById) ?? "—" : null,
    receivedBy: order.receivedById ? names.get(order.receivedById) ?? "—" : null,
    cancelledBy: order.cancelledById ? names.get(order.cancelledById) ?? "—" : null,
    emails: order.emails.map((email) => ({ ...email, sentBy: names.get(email.sentById) ?? "—" })),
    items: order.items.map((item) => ({ ...item, remaining: Math.max(0, item.quantity - item.receivedQty), freeDue: Math.max(0, item.freeQty - item.freeReceived) })),
    emailDefaults: {
      to: order.supplier.email ?? "",
      subject: `Purchase Order ${order.poNumber} from ${contact.fullName}`,
      message: defaultMessage(order.supplier.contactPerson, contact),
    },
  };
}

type OrderContact = { shopName: string; branchName: string | null; fullName: string; address: string; phone: string; email: string };

/** The ordering branch's name, address, phone and email; anything the branch hasn't set comes from Shop Settings. */
function orderContact(branch: { name: string; address: string | null; phone: string | null; email: string | null; isMain: boolean } | null, settings: ShopSettings): OrderContact {
  return {
    shopName: settings.businessName,
    branchName: branch?.name ?? null,
    fullName: branch ? `${settings.businessName} — ${branch.name}` : settings.businessName,
    // The shop's address belongs to the main branch; another branch without an address shows none,
    // so a supplier is never sent to the wrong place.
    address: branch?.address || (!branch || branch.isMain ? settings.businessAddress : ""),
    phone: branch?.phone || settings.businessPhone,
    email: branch?.email || settings.businessEmail,
  };
}

function defaultMessage(contactPerson: string | null, contact: OrderContact) {
  return [
    `Dear ${contactPerson?.trim() || "Sir / Madam"},`,
    "",
    "Please find our purchase order below. Kindly confirm the order and the delivery date.",
    "",
    "Thank you,",
    contact.fullName,
    ...(contact.phone ? [contact.phone] : []),
    ...(contact.email ? [contact.email] : []),
  ].join("\n");
}

export type OrderQuery = { page: number; limit: number; status?: PurchaseOrderStatus; supplierId?: number; search?: string; from?: string; to?: string; branchId?: number };

export async function listOrders(query: OrderQuery) {
  const search = query.search?.trim();
  const where: Prisma.PurchaseOrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.from || query.to
      ? { orderDate: { ...(query.from ? { gte: new Date(`${query.from}T00:00:00`) } : {}), ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999`) } : {}) } }
      : {}),
    ...(search
      ? { OR: [
          { poNumber: { contains: search, mode: "insensitive" } },
          { supplier: { name: { contains: search, mode: "insensitive" } } },
          { items: { some: { description: { contains: search, mode: "insensitive" } } } },
        ] }
      : {}),
  };
  const [orders, total, byStatus] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        supplier: { select: { id: true, name: true, email: true } },
        items: { select: { quantity: true, receivedQty: true } },
        emails: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, toEmail: true, createdAt: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
    // Tab counts follow the branch in view.
    prisma.purchaseOrder.groupBy({ by: ["status"], where: query.branchId ? { branchId: query.branchId } : {}, _count: true, _sum: { total: true } }),
  ]);
  const names = await staffNames(orders.map((order) => order.createdById));
  const branchById = new Map((await prisma.branch.findMany({ select: { id: true, name: true, code: true } })).map((branch) => [branch.id, branch]));
  return {
    orders: orders.map((order) => ({
      id: order.id,
      poNumber: order.poNumber,
      supplier: order.supplier,
      /** The branch that placed the order (goods are delivered there). */
      branch: order.branchId ? branchById.get(order.branchId) ?? null : null,
      status: order.status,
      statusLabel: STATUS_LABELS[order.status as PurchaseOrderStatus] ?? order.status,
      orderDate: order.orderDate,
      expectedDate: order.expectedDate,
      total: order.total,
      lines: order.items.length,
      units: order.items.reduce((sum, item) => sum + item.quantity, 0),
      receivedUnits: order.items.reduce((sum, item) => sum + item.receivedQty, 0),
      lastEmail: order.emails[0] ?? null,
      createdBy: names.get(order.createdById) ?? "—",
    })),
    counts: Object.fromEntries(byStatus.map((row) => [row.status, { count: row._count, total: round2(row._sum.total ?? 0) }])),
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  };
}

export function emailStatus() {
  return { configured: emailConfigured(), sender: emailConfigured() ? senderAddress() : null };
}

/** The email the supplier receives: the full order as a table, plus the message typed by the admin. */
function orderEmail(order: Awaited<ReturnType<typeof getOrder>>, message: string, settings: ShopSettings) {
  const rows = order.items.map((item, index) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#666">${index + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee">${esc(item.description)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${item.quantity}${item.freeQty ? `<div style="font-size:12px;color:#17803d;font-weight:700">+ ${item.freeQty} free</div>` : ""}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${rupees(item.unitCost)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${rupees(item.lineTotal)}</td>
    </tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a16">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e6e0d2;border-radius:10px;overflow:hidden">
    <div style="padding:20px 24px;border-bottom:3px solid #1c1a16;display:block">
      <div style="font-size:20px;font-weight:800;letter-spacing:1px">${esc(order.contact.shopName)}</div>
      ${order.contact.branchName ? `<div style="font-size:14px;font-weight:700;margin-top:2px">${esc(order.contact.branchName)}</div>` : ""}
      <div style="font-size:13px;color:#555;margin-top:4px">${esc(order.contact.address)}${order.contact.phone ? ` · Tel ${esc(order.contact.phone)}` : ""}${order.contact.email ? ` · ${esc(order.contact.email)}` : ""}</div>
    </div>
    <div style="padding:20px 24px">
      <div style="font-size:12px;letter-spacing:2px;color:#8a6a1f;font-weight:700">PURCHASE ORDER</div>
      <div style="font-size:24px;font-weight:800;margin:4px 0 14px">${esc(order.poNumber)}</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
        <tr>
          <td style="vertical-align:top;padding-right:16px">
            <div style="font-size:11px;color:#888;letter-spacing:1px">TO</div>
            <div style="font-weight:700">${esc(order.supplier.name)}</div>
            ${order.supplier.contactPerson ? `<div>${esc(order.supplier.contactPerson)}</div>` : ""}
            ${order.supplier.address ? `<div style="color:#555">${esc(order.supplier.address)}</div>` : ""}
          </td>
          <td style="vertical-align:top;text-align:right">
            <div><span style="color:#888">Order date:</span> ${dateText(order.orderDate)}</div>
            ${order.expectedDate ? `<div><span style="color:#888">Deliver by:</span> <b>${dateText(order.expectedDate)}</b></div>` : ""}
            <div><span style="color:#888">Deliver to:</span> <b>${esc(order.contact.branchName ?? order.contact.shopName)}</b></div>
            <div style="color:#555">${esc(order.contact.address)}</div>
          </td>
        </tr>
      </table>
      <div style="white-space:pre-line;font-size:14px;line-height:1.5;margin-bottom:16px">${esc(message)}</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f5f1e6">
          <th style="padding:8px 10px;text-align:left;font-size:12px">#</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px">Item</th>
          <th style="padding:8px 10px;text-align:right;font-size:12px">Qty</th>
          <th style="padding:8px 10px;text-align:right;font-size:12px">Unit price</th>
          <th style="padding:8px 10px;text-align:right;font-size:12px">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="4" style="padding:10px;text-align:right;font-weight:700">Total</td>
          <td style="padding:10px;text-align:right;font-weight:800;font-size:16px">${rupees(order.total)}</td>
        </tr></tfoot>
      </table>
      ${order.notes ? `<div style="margin-top:16px;padding:10px 12px;background:#faf7f0;border-radius:6px;font-size:13px"><b>Notes:</b> ${esc(order.notes)}</div>` : ""}
      <div style="margin-top:20px;font-size:12px;color:#888">Please quote ${esc(order.poNumber)} on your invoice and delivery note.</div>
    </div>
  </div>
</body></html>`;
  const text = [
    `PURCHASE ORDER ${order.poNumber}`,
    `${order.contact.fullName} · ${order.contact.address}`,
    `To: ${order.supplier.name}`,
    `Order date: ${dateText(order.orderDate)}${order.expectedDate ? ` · Deliver by: ${dateText(order.expectedDate)}` : ""}`,
    `Deliver to: ${order.contact.branchName ?? order.contact.shopName}, ${order.contact.address}`,
    "",
    message,
    "",
    ...order.items.map((item, index) => `${index + 1}. ${item.description} — ${item.quantity} × ${rupees(item.unitCost)} = ${rupees(item.lineTotal)}${item.freeQty ? ` (+ ${item.freeQty} free)` : ""}`),
    `Total: ${rupees(order.total)}`,
    ...(order.notes ? ["", `Notes: ${order.notes}`] : []),
    "",
    `Please quote ${order.poNumber} on your invoice and delivery note.`,
  ].join("\n");
  return { html, text };
}

export type SendDto = { to: string; cc?: string; subject: string; message: string };

/** Emails the order to the supplier. Every attempt is recorded, including ones that fail. */
export async function sendOrder(id: number, dto: SendDto, actorId: number) {
  const order = await getOrder(id);
  if (order.status === "CANCELLED") throw new AppError(`${order.poNumber} is cancelled and can't be sent`, 400);
  const settings = await getSettings();
  const record = (status: "SENT" | "FAILED", extra: { error?: string; messageId?: string } = {}) =>
    prisma.purchaseOrderEmail.create({
      data: { orderId: id, toEmail: dto.to, ccEmail: dto.cc || null, subject: dto.subject, message: dto.message, status, sentById: actorId, ...extra },
    });

  if (!emailConfigured()) {
    await record("FAILED", { error: "Email is not set up on the server" });
    throw new AppError("Email isn't set up yet. Add the shop's email settings (SMTP) to the server, then send again.", 503);
  }
  const { html, text } = orderEmail(order, dto.message, settings);
  try {
    const result = await sendEmail({
      from: senderAddress(order.contact.fullName),
      to: dto.to,
      cc: dto.cc || undefined,
      // Supplier replies go to the ordering branch (else the shop's business email).
      replyTo: order.contact.email || undefined,
      subject: dto.subject,
      html,
      text,
    });
    await record("SENT", { messageId: result.messageId });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    await record("FAILED", { error: reason.slice(0, 500) });
    throw new AppError(`The email could not be sent: ${reason}`, 502);
  }
  if (order.status === "DRAFT") {
    await prisma.purchaseOrder.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), sentById: actorId } });
  }
  return getOrder(id);
}

export type ReceiveDto = {
  lines: Array<{ itemId: number; quantity: number; rejected?: number; rejectReason?: string | null; free?: number; unitCost?: number }>;
  supplierInvoiceNo?: string | null;
  invoiceDate?: string | null;
  invoiceTotal?: number | null;
  notes?: string | null;
};

/**
 * Books a delivery against the order as a GRN (Goods Received Note) at the order's branch. Product lines
 * go into that branch's stock; other lines (ice, supplies) are just marked as delivered.
 */
export async function receiveOrder(id: number, dto: ReceiveDto, actorId: number, branchId: number) {
  const order = await getOrder(id);
  if (order.status === "CANCELLED" || order.status === "RECEIVED") {
    throw new AppError(`${order.poNumber} is ${STATUS_LABELS[order.status as PurchaseOrderStatus].toLowerCase()}`, 400);
  }
  const itemById = new Map(order.items.map((item) => [item.id, item]));
  await createGrn({
    supplierId: order.supplierId,
    purchaseOrderId: order.id,
    supplierInvoiceNo: dto.supplierInvoiceNo,
    invoiceDate: dto.invoiceDate,
    invoiceTotal: dto.invoiceTotal,
    notes: dto.notes,
    lines: dto.lines.filter((line) => line.quantity > 0 || (line.rejected ?? 0) > 0 || (line.free ?? 0) > 0).map((line) => ({
      purchaseOrderItemId: line.itemId,
      delivered: line.quantity + (line.rejected ?? 0),
      rejected: line.rejected ?? 0,
      free: line.free ?? 0,
      rejectReason: line.rejectReason ?? null,
      unitCost: line.unitCost ?? itemById.get(line.itemId)?.unitCost ?? 0,
    })),
  }, actorId, branchId);
  return getOrder(id);
}

export async function cancelOrder(id: number, reason: string, actorId: number) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!order) throw AppError.notFound("Purchase order not found");
  if (order.status === "RECEIVED" || order.status === "CANCELLED") {
    throw new AppError(`${order.poNumber} is already ${STATUS_LABELS[order.status as PurchaseOrderStatus].toLowerCase()}`, 400);
  }
  await prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: actorId, cancelReason: reason.trim() } });
  return getOrder(id);
}
