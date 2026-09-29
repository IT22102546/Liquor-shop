import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { findOpenShift, recordMovements } from "../book/stock-movements";
import { changeStock } from "../branches/branch-stock";

/**
 * GTN (Goods Transfer Note): stock sent from one branch to another.
 * SENT — the bottles leave the sending branch's shelf (in transit).
 * RECEIVED — the receiving branch checks each line: good bottles go on its shelf, damaged ones into its
 *            damaged stock, and missing ones are recorded as lost in transit.
 * CANCELLED — sent by mistake: the bottles go back on the sending branch's shelf.
 */

export const GTN_STATUS_LABELS: Record<string, string> = { SENT: "In transit", RECEIVED: "Received", CANCELLED: "Cancelled" };
const round2 = (value: number) => Math.round(value * 100) / 100;

async function nextGtnNo(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(740312)");
  const last = await tx.gtn.findFirst({ orderBy: { id: "desc" }, select: { gtnNo: true } });
  return `GTN-${String((last ? Number(last.gtnNo.replace(/\D/g, "")) : 0) + 1).padStart(5, "0")}`;
}

export async function createGtn(
  dto: { toBranchId: number; notes?: string | null; carriedBy?: string | null; lines: Array<{ productId: number; quantity: number }> },
  actorId: number,
  fromBranchId: number,
) {
  if (dto.toBranchId === fromBranchId) throw AppError.validation({ toBranchId: ["Choose a different branch to send to"] });
  const [from, to] = await Promise.all([
    prisma.branch.findUnique({ where: { id: fromBranchId } }),
    prisma.branch.findFirst({ where: { id: dto.toBranchId, isActive: true } }),
  ]);
  if (!from) throw AppError.notFound("Branch not found");
  if (!to) throw AppError.validation({ toBranchId: ["Choose the branch to send to"] });
  const merged = new Map<number, number>();
  dto.lines.filter((line) => line.quantity > 0).forEach((line) => merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity));
  if (merged.size === 0) throw AppError.validation({ lines: ["Add the bottles to send"] });
  const products = await prisma.inventoryProduct.findMany({
    where: { id: { in: [...merged.keys()] } },
    select: { id: true, name: true, compatibleWith: true, purchasePrice: true, taxPaid: true, additionalExpenses: true },
  });
  if (products.length !== merged.size) throw AppError.validation({ lines: ["Some products no longer exist — reload and try again"] });

  const gtn = await prisma.$transaction(async (tx) => {
    const gtnNo = await nextGtnNo(tx);
    const shift = await findOpenShift(tx, fromBranchId);
    for (const product of products) {
      await changeStock(tx, fromBranchId, product.id, { quantity: -merged.get(product.id)! });
    }
    const created = await tx.gtn.create({
      data: {
        gtnNo, fromBranchId, toBranchId: to.id, status: "SENT",
        notes: dto.notes?.trim() || null, carriedBy: dto.carriedBy?.trim() || null,
        sentById: actorId, sentShiftId: shift?.id ?? null,
        items: {
          create: products.map((product) => ({
            productId: product.id,
            productName: [product.name, product.compatibleWith].filter(Boolean).join(" · "),
            sentQty: merged.get(product.id)!,
            unitCost: product.purchasePrice == null ? null : round2(product.purchasePrice + (product.taxPaid ?? 0) + (product.additionalExpenses ?? 0)),
          })),
        },
      },
    });
    await recordMovements(tx, products.map((product) => ({
      productId: product.id, kind: "STOCK" as const, type: "TRANSFER_OUT" as const, quantity: -merged.get(product.id)!, reference: `${gtnNo} · to ${to.name}`, createdById: actorId,
    })), { branchId: fromBranchId, shiftId: shift?.id ?? null });
    return created;
  });
  return getGtn(gtn.id);
}

export async function receiveGtn(
  id: number,
  dto: { note?: string | null; lines: Array<{ itemId: number; received: number; damaged: number }> },
  actorId: number,
  branchId: number,
) {
  const gtn = await prisma.gtn.findUnique({ where: { id }, include: { items: true, fromBranch: true, toBranch: true } });
  if (!gtn) throw AppError.notFound("GTN not found");
  if (gtn.toBranchId !== branchId) throw AppError.forbidden(`${gtn.gtnNo} is for ${gtn.toBranch.name} — only that branch can receive it`);
  if (gtn.status !== "SENT") throw new AppError(`${gtn.gtnNo} is already ${GTN_STATUS_LABELS[gtn.status]?.toLowerCase() ?? gtn.status}`, 400);
  const byItem = new Map(dto.lines.map((line) => [line.itemId, line]));
  const checked = gtn.items.map((item) => {
    const line = byItem.get(item.id);
    if (!line) throw AppError.validation({ lines: [`Check ${item.productName} — enter how many arrived`] });
    const received = Math.max(0, Math.floor(line.received));
    const damaged = Math.max(0, Math.floor(line.damaged));
    if (received + damaged > item.sentQty) throw AppError.validation({ lines: [`${item.productName}: only ${item.sentQty} were sent`] });
    return { item, received, damaged, missing: item.sentQty - received - damaged };
  });
  if (checked.some((row) => row.missing > 0) && !dto.note?.trim()) {
    throw AppError.validation({ note: ["Some bottles are missing — write what happened (it goes on the note)"] });
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.gtn.updateMany({ where: { id, status: "SENT" }, data: { status: "RECEIVED", receivedById: actorId, receivedAt: new Date(), receiveNote: dto.note?.trim() || null } });
    if (updated.count !== 1) throw new AppError(`${gtn.gtnNo} was just received or cancelled`, 409);
    const shift = await findOpenShift(tx, branchId);
    await tx.gtn.update({ where: { id }, data: { receivedShiftId: shift?.id ?? null } });
    for (const row of checked) {
      await tx.gtnItem.update({ where: { id: row.item.id }, data: { receivedQty: row.received, damagedQty: row.damaged, missingQty: row.missing } });
      if (row.item.productId) await changeStock(tx, branchId, row.item.productId, { quantity: row.received, damaged: row.damaged });
    }
    const reference = `${gtn.gtnNo} · from ${gtn.fromBranch.name}`;
    await recordMovements(tx, checked.filter((row) => row.item.productId).flatMap((row) => [
      { productId: row.item.productId!, kind: "STOCK" as const, type: "TRANSFER_IN" as const, quantity: row.received, reference, createdById: actorId },
      { productId: row.item.productId!, kind: "DAMAGED" as const, type: "IN" as const, quantity: row.damaged, reference: `${reference} (arrived damaged)`, createdById: actorId },
    ]), { branchId, shiftId: shift?.id ?? null });
  });
  return getGtn(id);
}

/** Sent by mistake (not received yet): the bottles go back on the sending branch's shelf. */
export async function cancelGtn(id: number, reason: string, actorId: number, branchId: number, isAdmin: boolean) {
  const gtn = await prisma.gtn.findUnique({ where: { id }, include: { items: true, toBranch: true } });
  if (!gtn) throw AppError.notFound("GTN not found");
  if (gtn.fromBranchId !== branchId && !isAdmin) throw AppError.forbidden("Only the sending branch can cancel a transfer");
  if (gtn.status !== "SENT") throw new AppError(`${gtn.gtnNo} is already ${GTN_STATUS_LABELS[gtn.status]?.toLowerCase() ?? gtn.status}`, 400);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.gtn.updateMany({ where: { id, status: "SENT" }, data: { status: "CANCELLED", cancelledById: actorId, cancelledAt: new Date(), cancelReason: reason.trim() } });
    if (updated.count !== 1) throw new AppError(`${gtn.gtnNo} was just received or cancelled`, 409);
    for (const item of gtn.items) {
      if (item.productId) await changeStock(tx, gtn.fromBranchId, item.productId, { quantity: item.sentQty });
    }
    await recordMovements(tx, gtn.items.filter((item) => item.productId).map((item) => ({
      productId: item.productId!, kind: "STOCK" as const, type: "TRANSFER_IN" as const, quantity: item.sentQty, reference: `${gtn.gtnNo} cancelled (not sent to ${gtn.toBranch.name})`, createdById: actorId,
    })), { branchId: gtn.fromBranchId });
  });
  return getGtn(id);
}

export async function getGtn(id: number) {
  const gtn = await prisma.gtn.findUnique({ where: { id }, include: { items: { orderBy: { id: "asc" } }, fromBranch: true, toBranch: true } });
  if (!gtn) throw AppError.notFound("GTN not found");
  const ids = [gtn.sentById, gtn.receivedById, gtn.cancelledById].filter((value): value is number => Boolean(value));
  const names = new Map((await prisma.posAdmin.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((row) => [row.id, row.name]));
  const branchInfo = (branch: typeof gtn.fromBranch) => ({ id: branch.id, name: branch.name, code: branch.code, address: branch.address, phone: branch.phone });
  return {
    ...gtn,
    statusLabel: GTN_STATUS_LABELS[gtn.status] ?? gtn.status,
    fromBranch: branchInfo(gtn.fromBranch),
    toBranch: branchInfo(gtn.toBranch),
    sentBy: names.get(gtn.sentById) ?? "—",
    receivedBy: gtn.receivedById ? names.get(gtn.receivedById) ?? "—" : null,
    cancelledBy: gtn.cancelledById ? names.get(gtn.cancelledById) ?? "—" : null,
    totals: {
      sent: gtn.items.reduce((sum, item) => sum + item.sentQty, 0),
      received: gtn.items.reduce((sum, item) => sum + (item.receivedQty ?? 0), 0),
      damaged: gtn.items.reduce((sum, item) => sum + item.damagedQty, 0),
      missing: gtn.items.reduce((sum, item) => sum + item.missingQty, 0),
      value: round2(gtn.items.reduce((sum, item) => sum + (item.unitCost ?? 0) * item.sentQty, 0)),
    },
  };
}

/** Transfers in and out of a branch (or all branches). "incoming" = still to be received here. */
export async function listGtns(q: { page: number; limit: number; direction?: "in" | "out"; status?: "SENT" | "RECEIVED" | "CANCELLED"; search?: string }, branchId: number | null) {
  const search = q.search?.trim();
  const side: Prisma.GtnWhereInput = !branchId ? {} : q.direction === "in" ? { toBranchId: branchId } : q.direction === "out" ? { fromBranchId: branchId } : { OR: [{ toBranchId: branchId }, { fromBranchId: branchId }] };
  const where: Prisma.GtnWhereInput = {
    AND: [
      side,
      q.status ? { status: q.status } : {},
      search ? { OR: [{ gtnNo: { contains: search, mode: "insensitive" } }, { items: { some: { productName: { contains: search, mode: "insensitive" } } } }] } : {},
    ],
  };
  const [rows, total, waiting] = await Promise.all([
    prisma.gtn.findMany({
      where, orderBy: [{ sentAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.limit, take: q.limit,
      include: { fromBranch: { select: { name: true } }, toBranch: { select: { name: true } }, items: { select: { sentQty: true, receivedQty: true, damagedQty: true, missingQty: true } } },
    }),
    prisma.gtn.count({ where }),
    branchId ? prisma.gtn.count({ where: { toBranchId: branchId, status: "SENT" } }) : prisma.gtn.count({ where: { status: "SENT" } }),
  ]);
  const names = new Map((await prisma.posAdmin.findMany({ where: { id: { in: [...new Set(rows.flatMap((row) => [row.sentById, row.receivedById]).filter((value): value is number => Boolean(value)))] } }, select: { id: true, name: true } })).map((row) => [row.id, row.name]));
  return {
    rows: rows.map((row) => ({
      id: row.id, gtnNo: row.gtnNo, status: row.status, statusLabel: GTN_STATUS_LABELS[row.status] ?? row.status,
      fromBranchId: row.fromBranchId, toBranchId: row.toBranchId, fromBranch: row.fromBranch.name, toBranch: row.toBranch.name,
      sentAt: row.sentAt, receivedAt: row.receivedAt, sentBy: names.get(row.sentById) ?? "—", receivedBy: row.receivedById ? names.get(row.receivedById) ?? "—" : null,
      lines: row.items.length, sent: row.items.reduce((sum, item) => sum + item.sentQty, 0),
      received: row.items.reduce((sum, item) => sum + (item.receivedQty ?? 0), 0),
      damaged: row.items.reduce((sum, item) => sum + item.damagedQty, 0), missing: row.items.reduce((sum, item) => sum + item.missingQty, 0),
    })),
    total,
    waitingToReceive: waiting,
  };
}
