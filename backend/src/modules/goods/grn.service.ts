import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { findOpenShift } from "../book/stock-movements";
import { restockProduct } from "../inventory-management/inventory-management.service";

/**
 * GRN (Goods Received Note): a supplier's delivery checked in at a branch. Accepted units go into that
 * branch's stock (cost blended into the product's cost price); rejected units go back with the driver
 * and are only recorded. A GRN can be against a purchase order (it updates what's still to come) or not.
 */

const round2 = (value: number) => Math.round(value * 100) / 100;

export type GrnLineInput = {
  productId?: number | null;
  purchaseOrderItemId?: number | null;
  description?: string;
  delivered: number;
  rejected?: number;
  rejectReason?: string | null;
  unitCost: number;
};
export type GrnInput = {
  supplierId: number;
  purchaseOrderId?: number | null;
  supplierInvoiceNo?: string | null;
  invoiceDate?: string | null;
  invoiceTotal?: number | null;
  notes?: string | null;
  lines: GrnLineInput[];
};

async function nextGrnNo(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(740311)");
  const last = await tx.grn.findFirst({ orderBy: { id: "desc" }, select: { grnNo: true } });
  return `GRN-${String((last ? Number(last.grnNo.replace(/\D/g, "")) : 0) + 1).padStart(5, "0")}`;
}

export async function createGrn(dto: GrnInput, actorId: number, branchId: number) {
  const supplier = await prisma.supplier.findUnique({ where: { id: dto.supplierId } });
  if (!supplier) throw AppError.validation({ supplierId: ["Choose the supplier"] });
  const order = dto.purchaseOrderId
    ? await prisma.purchaseOrder.findUnique({ where: { id: dto.purchaseOrderId }, include: { items: true } })
    : null;
  if (dto.purchaseOrderId && !order) throw AppError.validation({ purchaseOrderId: ["Purchase order not found"] });
  if (order) {
    if (order.supplierId !== supplier.id) throw AppError.validation({ purchaseOrderId: [`${order.poNumber} is for a different supplier`] });
    if (order.status === "CANCELLED" || order.status === "RECEIVED") throw AppError.validation({ purchaseOrderId: [`${order.poNumber} is ${order.status === "CANCELLED" ? "cancelled" : "already fully received"}`] });
    if (order.branchId && order.branchId !== branchId) {
      const deliverTo = await prisma.branch.findUnique({ where: { id: order.branchId }, select: { name: true } });
      throw AppError.validation({ purchaseOrderId: [`${order.poNumber} is to be delivered to ${deliverTo?.name ?? "another branch"} — receive it there (switch branch at the top)`] });
    }
  }

  const lines = dto.lines.filter((line) => line.delivered > 0);
  if (lines.length === 0) throw AppError.validation({ lines: ["Enter what was delivered"] });
  const productIds = [...new Set(lines.map((line) => line.productId).filter((id): id is number => Boolean(id)))];
  const products = new Map((await prisma.inventoryProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, compatibleWith: true } })).map((product) => [product.id, product]));
  const orderItems = new Map((order?.items ?? []).map((item) => [item.id, item]));

  const built = lines.map((line, index) => {
    const rejected = Math.max(0, line.rejected ?? 0);
    if (rejected > line.delivered) throw AppError.validation({ lines: [`Line ${index + 1}: rejected can't be more than delivered`] });
    if (rejected > 0 && !line.rejectReason?.trim()) throw AppError.validation({ lines: [`Line ${index + 1}: say why ${rejected} were rejected`] });
    const accepted = line.delivered - rejected;
    const orderItem = line.purchaseOrderItemId ? orderItems.get(line.purchaseOrderItemId) : undefined;
    if (line.purchaseOrderItemId && !orderItem) throw AppError.validation({ lines: [`Line ${index + 1}: that item is not on ${order?.poNumber ?? "the order"}`] });
    const productId = orderItem?.productId ?? line.productId ?? null;
    const product = productId ? products.get(productId) ?? null : null;
    if (line.productId && !product && !orderItem) throw AppError.validation({ lines: [`Line ${index + 1}: that product no longer exists`] });
    const remaining = orderItem ? Math.max(0, orderItem.quantity - orderItem.receivedQty) : null;
    if (orderItem && accepted > remaining!) throw AppError.validation({ lines: [`${orderItem.description}: only ${remaining} still due on ${order!.poNumber}`] });
    const description = orderItem?.description ?? line.description?.trim() ?? (product ? [product.name, product.compatibleWith].filter(Boolean).join(" · ") : "");
    if (!description) throw AppError.validation({ lines: [`Line ${index + 1}: choose a product or describe the item`] });
    const unitCost = round2(line.unitCost);
    return {
      productId, description, purchaseOrderItemId: orderItem?.id ?? null, orderedQty: remaining,
      deliveredQty: line.delivered, acceptedQty: accepted, rejectedQty: rejected, rejectReason: rejected ? line.rejectReason!.trim() : null,
      unitCost, lineTotal: round2(accepted * unitCost),
    };
  });

  const grn = await prisma.$transaction(async (tx) => {
    const grnNo = await nextGrnNo(tx);
    const shift = await findOpenShift(tx, branchId);
    const created = await tx.grn.create({
      data: {
        grnNo, branchId, supplierId: supplier.id, supplierName: supplier.name,
        purchaseOrderId: order?.id ?? null, poNumber: order?.poNumber ?? null,
        supplierInvoiceNo: dto.supplierInvoiceNo?.trim() || null,
        invoiceDate: dto.invoiceDate ? new Date(`${dto.invoiceDate}T12:00:00`) : null,
        invoiceTotal: dto.invoiceTotal ?? null,
        notes: dto.notes?.trim() || null,
        acceptedUnits: built.reduce((sum, line) => sum + line.acceptedQty, 0),
        rejectedUnits: built.reduce((sum, line) => sum + line.rejectedQty, 0),
        totalCost: round2(built.reduce((sum, line) => sum + line.lineTotal, 0)),
        shiftId: shift?.id ?? null,
        receivedById: actorId,
        items: { create: built },
      },
    });
    const reference = [grnNo, supplier.name, order?.poNumber, dto.supplierInvoiceNo?.trim() ? `inv ${dto.supplierInvoiceNo.trim()}` : null].filter(Boolean).join(" · ");
    for (const line of built) {
      // Accepted stock products go on this branch's shelf; other lines (ice, supplies) are only recorded.
      if (line.productId && line.acceptedQty > 0) {
        await restockProduct(line.productId, { quantity: line.acceptedQty, purchasePrice: line.lineTotal }, actorId, branchId, reference, tx);
      }
      if (line.purchaseOrderItemId && line.acceptedQty > 0) {
        await tx.purchaseOrderItem.update({ where: { id: line.purchaseOrderItemId }, data: { receivedQty: { increment: line.acceptedQty } } });
      }
    }
    if (order) {
      const items = await tx.purchaseOrderItem.findMany({ where: { orderId: order.id } });
      const complete = items.every((item) => item.receivedQty >= item.quantity);
      const anything = items.some((item) => item.receivedQty > 0);
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: complete ? { status: "RECEIVED", receivedAt: new Date(), receivedById: actorId } : anything ? { status: "PARTIAL" } : {},
      });
    }
    return created;
  });
  return getGrn(grn.id);
}

/** What the New GRN form needs: suppliers, and purchase orders still to be delivered to this branch. */
export async function grnSetup(branchId: number) {
  const [suppliers, orders] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["DRAFT", "SENT", "PARTIAL"] }, OR: [{ branchId }, { branchId: null }] },
      orderBy: { orderDate: "desc" },
      include: { items: { orderBy: { id: "asc" } } },
    }),
  ]);
  return {
    suppliers,
    orders: orders
      .map((order) => ({
        id: order.id, poNumber: order.poNumber, supplierId: order.supplierId, status: order.status, orderDate: order.orderDate, expectedDate: order.expectedDate,
        items: order.items
          .map((item) => ({ id: item.id, productId: item.productId, description: item.description, ordered: item.quantity, received: item.receivedQty, remaining: Math.max(0, item.quantity - item.receivedQty), unitCost: item.unitCost }))
          .filter((item) => item.remaining > 0),
      }))
      .filter((order) => order.items.length > 0),
  };
}

export async function getGrn(id: number) {
  const grn = await prisma.grn.findUnique({ where: { id }, include: { items: { orderBy: { id: "asc" } }, branch: true } });
  if (!grn) throw AppError.notFound("GRN not found");
  const [by, supplier] = await Promise.all([
    prisma.posAdmin.findUnique({ where: { id: grn.receivedById }, select: { name: true } }),
    grn.supplierId ? prisma.supplier.findUnique({ where: { id: grn.supplierId }, select: { name: true, code: true, telephone: true, address: true } }) : null,
  ]);
  const shift = grn.shiftId ? await prisma.posShift.findUnique({ where: { id: grn.shiftId }, select: { shiftNo: true } }) : null;
  return {
    ...grn,
    branch: { id: grn.branch.id, name: grn.branch.name, code: grn.branch.code, address: grn.branch.address, phone: grn.branch.phone },
    supplier,
    receivedBy: by?.name ?? "—",
    shiftNo: shift?.shiftNo ?? null,
    // Difference between the supplier's invoice and what was accepted (at the cost entered).
    invoiceDifference: grn.invoiceTotal != null ? round2(grn.invoiceTotal - grn.totalCost) : null,
  };
}

export async function listGrns(q: { page: number; limit: number; search?: string; supplierId?: number; from?: string; to?: string }, branchId: number | null) {
  const search = q.search?.trim();
  const where: Prisma.GrnWhereInput = {
    ...(branchId ? { branchId } : {}),
    ...(q.supplierId ? { supplierId: q.supplierId } : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999`) } : {}) } } : {}),
    ...(search ? { OR: [
      { grnNo: { contains: search, mode: "insensitive" } },
      { supplierName: { contains: search, mode: "insensitive" } },
      { supplierInvoiceNo: { contains: search, mode: "insensitive" } },
      { poNumber: { contains: search, mode: "insensitive" } },
      { items: { some: { description: { contains: search, mode: "insensitive" } } } },
    ] } : {}),
  };
  const [rows, total, sums] = await Promise.all([
    prisma.grn.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.limit, take: q.limit, include: { branch: { select: { name: true } }, _count: { select: { items: true } } } }),
    prisma.grn.count({ where }),
    prisma.grn.aggregate({ where, _sum: { totalCost: true, acceptedUnits: true, rejectedUnits: true } }),
  ]);
  const names = new Map((await prisma.posAdmin.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.receivedById))] } }, select: { id: true, name: true } })).map((row) => [row.id, row.name]));
  return {
    rows: rows.map((row) => ({
      id: row.id, grnNo: row.grnNo, createdAt: row.createdAt, branch: row.branch.name, supplierName: row.supplierName, poNumber: row.poNumber,
      supplierInvoiceNo: row.supplierInvoiceNo, invoiceTotal: row.invoiceTotal, totalCost: row.totalCost,
      acceptedUnits: row.acceptedUnits, rejectedUnits: row.rejectedUnits, lines: row._count.items, receivedBy: names.get(row.receivedById) ?? "—",
    })),
    total,
    totals: { cost: round2(sums._sum.totalCost ?? 0), accepted: sums._sum.acceptedUnits ?? 0, rejected: sums._sum.rejectedUnits ?? 0 },
  };
}
