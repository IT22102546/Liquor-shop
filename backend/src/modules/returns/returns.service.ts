import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { drawerCash } from "../book/cash-book.service";
import { findOpenShift, recordMovements } from "../book/stock-movements";
import { changeStock, forBranch } from "../branches/branch-stock";
import { getSettings } from "../settings/settings.service";

type Tx = Prisma.TransactionClient;
const round2 = (value: number) => Math.round(value * 100) / 100;
const rs = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const RETURN_TYPES = ["EXCHANGE", "REFUND", "STORE_DAMAGE", "DAMAGE_CLEARED"] as const;
export type ReturnType = (typeof RETURN_TYPES)[number];
export const TYPE_LABELS: Record<string, string> = {
  EXCHANGE: "Damaged bottle exchanged",
  REFUND: "Returned & refunded",
  STORE_DAMAGE: "Damaged in store",
  DAMAGE_CLEARED: "Damaged stock cleared",
};
export const DISPOSAL_LABELS: Record<string, string> = {
  SUPPLIER: "Sent back to supplier",
  WRITTEN_OFF: "Thrown away (written off)",
  RESTORED: "Put back on the shelf",
};

const productLabel = (product: { name: string; compatibleWith: string | null }) => [product.name, product.compatibleWith].filter(Boolean).join(" · ");
const unitCostOf = (product: { purchasePrice: number | null; taxPaid: number | null; additionalExpenses: number | null }) =>
  product.purchasePrice == null ? null : round2(product.purchasePrice + (product.taxPaid ?? 0) + (product.additionalExpenses ?? 0));
const PRODUCT_SELECT = { id: true, name: true, compatibleWith: true, quantity: true, damagedQuantity: true, sellingPrice: true, purchasePrice: true, taxPaid: true, additionalExpenses: true } as const;

/** Next RT- number; the advisory lock stops two tills taking the same number. */
async function nextReturnNo(tx: Tx) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(740301)");
  const last = await tx.posReturn.findFirst({ orderBy: { id: "desc" }, select: { returnNo: true } });
  const number = last ? Number(last.returnNo.replace(/\D/g, "")) + 1 : 1;
  return `RT-${String(number).padStart(5, "0")}`;
}

async function productOrFail(tx: Tx, productId: number) {
  const product = await tx.inventoryProduct.findUnique({ where: { id: productId }, select: PRODUCT_SELECT });
  if (!product) throw AppError.validation({ productId: ["Choose a product"] });
  return product;
}

/** Moves bottles off this branch's shelf into its damaged stock; fails if another till sold them a moment ago. */
async function shelfToDamaged(tx: Tx, branchId: number, productId: number, quantity: number) {
  await changeStock(tx, branchId, productId, { quantity: -quantity, damaged: quantity });
}

// ── Damaged bottle exchange: customer brings back a damaged bottle and gets a new one ──
export async function createExchange(
  dto: { productId: number; quantity: number; billNo?: string | null; customerName?: string | null; customerMobile?: string | null; reason: string; note?: string | null },
  actorId: number,
  branchId: number,
) {
  return prisma.$transaction(async (tx) => {
    const product = await productOrFail(tx, dto.productId);
    const billNo = dto.billNo?.trim() || null;
    let customerId: number | null = null;
    if (billNo) {
      const sale = await tx.posCounterSale.findUnique({ where: { invoiceGroupCode: billNo }, select: { customerId: true } });
      if (!sale) throw AppError.validation({ billNo: [`No bill ${billNo} — leave it empty if the customer has no bill`] });
      customerId = sale.customerId;
    }
    await shelfToDamaged(tx, branchId, product.id, dto.quantity);
    const shift = await findOpenShift(tx, branchId);
    const returnNo = await nextReturnNo(tx);
    const row = await tx.posReturn.create({
      data: {
        returnNo, type: "EXCHANGE", productId: product.id, productName: productLabel(product), quantity: dto.quantity,
        invoiceGroupCode: billNo, customerId, customerName: dto.customerName?.trim() || null, customerMobile: dto.customerMobile?.trim() || null,
        unitPrice: product.sellingPrice ?? 0, unitCost: unitCostOf(product), reason: dto.reason, note: dto.note?.trim() || null,
        shiftId: shift?.id ?? null, branchId, createdById: actorId,
      },
    });
    await recordMovements(tx, [
      { productId: product.id, kind: "STOCK", type: "EXCHANGED", quantity: -dto.quantity, reference: returnNo, createdById: actorId },
      { productId: product.id, kind: "DAMAGED", type: "IN", quantity: dto.quantity, reference: returnNo, createdById: actorId },
    ], { branchId, shiftId: shift?.id ?? null });
    return getReturn(row.returnNo, tx);
  });
}

// ── Damage found in the store: moved off the shelf and kept aside ──
export async function createStoreDamage(dto: { productId: number; quantity: number; reason: string; note?: string | null }, actorId: number, branchId: number) {
  return prisma.$transaction(async (tx) => {
    const product = await productOrFail(tx, dto.productId);
    await shelfToDamaged(tx, branchId, product.id, dto.quantity);
    const shift = await findOpenShift(tx, branchId);
    const returnNo = await nextReturnNo(tx);
    await tx.posReturn.create({
      data: {
        returnNo, type: "STORE_DAMAGE", productId: product.id, productName: productLabel(product), quantity: dto.quantity,
        unitPrice: product.sellingPrice ?? 0, unitCost: unitCostOf(product), reason: dto.reason, note: dto.note?.trim() || null,
        shiftId: shift?.id ?? null, branchId, createdById: actorId,
      },
    });
    await recordMovements(tx, [
      { productId: product.id, kind: "STOCK", type: "DAMAGED", quantity: -dto.quantity, reference: returnNo, createdById: actorId },
      { productId: product.id, kind: "DAMAGED", type: "IN", quantity: dto.quantity, reference: returnNo, createdById: actorId },
    ], { branchId, shiftId: shift?.id ?? null });
    return getReturn(returnNo, tx);
  });
}

// ── Clearing damaged stock (administrators): back to supplier, thrown away, or back on the shelf ──
export async function clearDamaged(
  dto: { productId: number; quantity: number; disposal: "SUPPLIER" | "WRITTEN_OFF" | "RESTORED"; reason: string; reference?: string | null; note?: string | null },
  actorId: number,
  branchId: number,
) {
  return prisma.$transaction(async (tx) => {
    const product = await productOrFail(tx, dto.productId);
    await changeStock(tx, branchId, product.id, { damaged: -dto.quantity, ...(dto.disposal === "RESTORED" ? { quantity: dto.quantity } : {}) });
    const shift = await findOpenShift(tx, branchId);
    const returnNo = await nextReturnNo(tx);
    await tx.posReturn.create({
      data: {
        returnNo, type: "DAMAGE_CLEARED", productId: product.id, productName: productLabel(product), quantity: dto.quantity,
        unitPrice: product.sellingPrice ?? 0, unitCost: unitCostOf(product), disposal: dto.disposal, reason: dto.reason,
        reference: dto.reference?.trim() || null, note: dto.note?.trim() || null, shiftId: shift?.id ?? null, branchId, createdById: actorId,
      },
    });
    await recordMovements(tx, [
      { productId: product.id, kind: "DAMAGED", type: "CLEARED", quantity: -dto.quantity, reference: returnNo, createdById: actorId },
      ...(dto.disposal === "RESTORED" ? [{ productId: product.id, kind: "STOCK" as const, type: "RESTORED" as const, quantity: dto.quantity, reference: returnNo, createdById: actorId }] : []),
    ], { branchId, shiftId: shift?.id ?? null });
    return getReturn(returnNo, tx);
  });
}

// ── Return & refund: bottles from a bill brought back (e.g. sale or return) and the money paid back ──

/** Bills to pick from: matching bill number or member mobile, newest first (defaults to the last 3 days). */
export async function findBills(search?: string) {
  const term = search?.trim();
  const where: Prisma.PosCounterSaleWhereInput = term
    ? { OR: [{ invoiceGroupCode: { contains: term, mode: "insensitive" } }, { customer: { mobileNumber: { contains: term.replace(/\s+/g, "") } } }] }
    : { createdAt: { gte: new Date(Date.now() - 3 * 24 * 3600 * 1000) } };
  const sales = await prisma.posCounterSale.findMany({
    where, orderBy: { createdAt: "desc" }, take: 20,
    select: { invoiceGroupCode: true, createdAt: true, totalAmount: true, cashier: { select: { name: true } }, customer: { select: { firstName: true, lastName: true, mobileNumber: true } } },
  });
  const lines = await prisma.posCustomerPurchase.findMany({
    where: { invoiceGroupCode: { in: sales.map((sale) => sale.invoiceGroupCode) } },
    select: { invoiceGroupCode: true, quantity: true, inventoryProduct: { select: { name: true } } },
  });
  return sales.map((sale) => ({
    billNo: sale.invoiceGroupCode,
    time: sale.createdAt,
    total: sale.totalAmount,
    cashier: sale.cashier.name,
    customer: sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim() : "Walk-in",
    mobile: sale.customer?.mobileNumber ?? null,
    items: lines.filter((line) => line.invoiceGroupCode === sale.invoiceGroupCode).map((line) => `${line.quantity} × ${line.inventoryProduct?.name ?? "Item"}`).join(", "),
  }));
}

/** A bill's lines with how many bottles can still come back and the refund per bottle. */
export async function getBillForReturn(billNo: string, db: Tx | typeof prisma = prisma) {
  const sale = await db.posCounterSale.findUnique({
    where: { invoiceGroupCode: billNo },
    select: {
      invoiceGroupCode: true, createdAt: true, totalAmount: true, discountAmount: true, pointsValue: true, pointsEarned: true, pointsRate: true, paymentMethod: true, voucherFree: true,
      cashier: { select: { name: true } }, customer: { select: { id: true, firstName: true, lastName: true, mobileNumber: true, loyaltyPoints: true } },
    },
  });
  if (!sale) throw AppError.notFound(`No bill ${billNo}`);
  const [lines, returned] = await Promise.all([
    db.posCustomerPurchase.findMany({
      where: { invoiceGroupCode: billNo, inventoryProductId: { not: null } },
      select: { inventoryProductId: true, quantity: true, finalSellingPrice: true, emptyDeduction: true, currentSellingPrice: true, inventoryProduct: { select: { name: true, compatibleWith: true } } },
    }),
    db.posReturn.findMany({ where: { invoiceGroupCode: billNo, type: "REFUND" }, select: { productId: true, quantity: true, refundAmount: true, pointsReversed: true } }),
  ]);
  const byProduct = new Map<number, { productId: number; name: string; sold: number; paid: number; listPrice: number }>();
  lines.forEach((line) => {
    const id = line.inventoryProductId as number;
    const entry = byProduct.get(id) ?? { productId: id, name: line.inventoryProduct ? productLabel(line.inventoryProduct) : "Item", sold: 0, paid: 0, listPrice: line.currentSellingPrice ?? 0 };
    entry.sold += line.quantity;
    // What the customer paid for these bottles after the bill discount / points (empties credit is separate).
    entry.paid = round2(entry.paid + line.finalSellingPrice + line.emptyDeduction);
    byProduct.set(id, entry);
  });
  const refunded = round2(returned.reduce((sum, row) => sum + row.refundAmount, 0));
  return {
    billNo: sale.invoiceGroupCode,
    time: sale.createdAt,
    cashier: sale.cashier.name,
    total: sale.totalAmount,
    refundedSoFar: refunded,
    // The part paid with a free gift voucher was never paid in money, so it isn't refunded.
    refundableLeft: round2(Math.max(0, sale.totalAmount - sale.voucherFree - refunded)),
    freeVoucher: sale.voucherFree,
    member: sale.customer
      ? { id: sale.customer.id, name: `${sale.customer.firstName} ${sale.customer.lastName}`.trim(), mobile: sale.customer.mobileNumber, points: sale.customer.loyaltyPoints }
      : null,
    pointsEarned: sale.pointsEarned,
    pointsReversedSoFar: returned.reduce((sum, row) => sum + row.pointsReversed, 0),
    pointsRate: sale.pointsRate,
    lines: [...byProduct.values()].map((line) => {
      const back = returned.filter((row) => row.productId === line.productId).reduce((sum, row) => sum + row.quantity, 0);
      const unitRefund = round2(Math.min(line.listPrice || Infinity, line.paid / line.sold));
      return { productId: line.productId, name: line.name, sold: line.sold, returned: back, returnable: line.sold - back, unitRefund };
    }),
  };
}

export async function createRefund(
  dto: { billNo: string; lines: Array<{ productId: number; quantity: number; condition: "SHELF" | "DAMAGED" }>; method: "CASH" | "WALLET"; reason: string; note?: string | null },
  actorId: number,
  branchId: number,
) {
  const settings = await getSettings();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(740302)");
    const bill = await getBillForReturn(dto.billNo, tx);
    const wanted = dto.lines.filter((line) => line.quantity > 0);
    if (wanted.length === 0) throw AppError.validation({ lines: ["Enter how many bottles came back"] });
    const rows = wanted.map((line) => {
      const billLine = bill.lines.find((item) => item.productId === line.productId);
      if (!billLine) throw AppError.validation({ lines: ["That product is not on this bill"] });
      if (line.quantity > billLine.returnable) {
        throw AppError.validation({ lines: [`Only ${billLine.returnable} ${billLine.name} from this bill can come back (${billLine.returned} already returned)`] });
      }
      return { ...line, name: billLine.name, unitRefund: billLine.unitRefund, amount: round2(billLine.unitRefund * line.quantity) };
    });
    let total = round2(rows.reduce((sum, row) => sum + row.amount, 0));
    // Never pay back more than the bill was paid (the last pennies of rounding go to the shop).
    if (total > bill.refundableLeft) {
      const scale = bill.refundableLeft / total;
      rows.forEach((row) => { row.amount = round2(row.amount * scale); });
      total = round2(rows.reduce((sum, row) => sum + row.amount, 0));
    }

    // Bottles come back into the branch they were brought to; cash comes out of that branch's drawer.
    const shift = await findOpenShift(tx, branchId);
    if (dto.method === "CASH") {
      if (!shift) throw AppError.validation({ method: ["No shift is open at this branch — start a shift to pay money back from the cash drawer"] });
      const available = await drawerCash(shift.id, tx);
      if (total > available + 0.001) throw AppError.validation({ method: [`Only ${rs(available)} should be in the drawer`] });
    }
    if (dto.method === "WALLET" && !bill.member) throw AppError.validation({ method: ["This bill was a walk-in sale — only loyalty members have a wallet"] });

    // Loyalty: take back the points earned on the refunded part (at the bill's own rate), never below zero.
    let pointsReversed = 0;
    let member: { loyaltyPoints: number; walletBalance: number } | null = null;
    if (bill.member) {
      const rate = bill.pointsRate ?? settings.loyaltyRupeesPerPoint;
      const current = await tx.posCustomer.findUniqueOrThrow({ where: { id: bill.member.id }, select: { loyaltyPoints: true } });
      pointsReversed = Math.max(0, Math.min(rate > 0 ? Math.floor(total / rate) : 0, bill.pointsEarned - bill.pointsReversedSoFar, current.loyaltyPoints));
      member = await tx.posCustomer.update({
        where: { id: bill.member.id },
        data: {
          loyaltyPoints: { decrement: pointsReversed },
          totalSpent: { decrement: total },
          ...(dto.method === "WALLET" ? { walletBalance: { increment: total } } : {}),
        },
        select: { loyaltyPoints: true, walletBalance: true },
      });
    }

    const returnNo = await nextReturnNo(tx);
    const products = await tx.inventoryProduct.findMany({ where: { id: { in: rows.map((row) => row.productId) } }, select: { ...PRODUCT_SELECT, soldQuantity: true } });
    let pointsLeft = pointsReversed;
    for (const [index, row] of rows.entries()) {
      const product = products.find((item) => item.id === row.productId);
      // Points taken back are recorded on the first line.
      const linePoints = index === 0 ? pointsLeft : 0;
      pointsLeft -= linePoints;
      await tx.posReturn.create({
        data: {
          returnNo, type: "REFUND", productId: row.productId, productName: row.name, quantity: row.quantity, condition: row.condition,
          invoiceGroupCode: bill.billNo, customerId: bill.member?.id ?? null, customerName: bill.member?.name ?? null, customerMobile: bill.member?.mobile ?? null,
          unitPrice: row.unitRefund, refundAmount: row.amount, refundMethod: dto.method, pointsReversed: linePoints,
          unitCost: product ? unitCostOf(product) : null, reason: dto.reason, note: dto.note?.trim() || null,
          shiftId: shift?.id ?? null, branchId, createdById: actorId,
        },
      });
      if (product) {
        await changeStock(tx, branchId, product.id, row.condition === "SHELF" ? { quantity: row.quantity } : { damaged: row.quantity });
        // Bottles back are no longer counted as sold.
        await tx.inventoryProduct.update({ where: { id: product.id }, data: { soldQuantity: { decrement: Math.min(row.quantity, Math.max(0, product.soldQuantity)) } } });
      }
    }
    await recordMovements(tx, rows.map((row) => row.condition === "SHELF"
      ? { productId: row.productId, kind: "STOCK" as const, type: "CUSTOMER_RETURN" as const, quantity: row.quantity, reference: returnNo, createdById: actorId }
      : { productId: row.productId, kind: "DAMAGED" as const, type: "IN" as const, quantity: row.quantity, reference: returnNo, createdById: actorId }), { branchId, shiftId: shift?.id ?? null });

    if (dto.method === "WALLET" && bill.member && member) {
      await tx.posWalletTransaction.create({
        data: {
          customerId: bill.member.id, type: "REFUND", amount: total, balanceAfter: round2(member.walletBalance),
          invoiceGroupCode: bill.billNo, shiftId: shift?.id ?? null, note: `Refund ${returnNo} for bottles returned from bill ${bill.billNo}`, createdById: actorId,
        },
      });
    }
    return getReturn(returnNo, tx);
  });
}

// ── Reading ──

async function staffNames(ids: number[], db: Tx | typeof prisma = prisma) {
  const staff = await db.posAdmin.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true } });
  return new Map(staff.map((row) => [row.id, row.name]));
}

type ReturnRow = Prisma.PosReturnGetPayload<{ include: { shift: { select: { shiftNo: true } } } }>;
function mapRows(rows: ReturnRow[], names: Map<number, string>) {
  return rows.map((row) => ({
    id: row.id,
    returnNo: row.returnNo,
    time: row.createdAt,
    type: row.type,
    typeLabel: TYPE_LABELS[row.type] ?? row.type,
    productId: row.productId,
    product: row.productName,
    quantity: row.quantity,
    condition: row.condition,
    billNo: row.invoiceGroupCode,
    customer: row.customerName,
    mobile: row.customerMobile,
    unitPrice: row.unitPrice,
    refund: row.refundAmount,
    refundMethod: row.refundMethod,
    pointsReversed: row.pointsReversed,
    costValue: row.unitCost == null ? null : round2(row.unitCost * row.quantity),
    reason: row.reason,
    note: row.note,
    disposal: row.disposal,
    disposalLabel: row.disposal ? DISPOSAL_LABELS[row.disposal] ?? row.disposal : null,
    reference: row.reference,
    shiftNo: row.shift?.shiftNo ?? null,
    by: names.get(row.createdById) ?? "—",
  }));
}

/** One return (all its lines), as printed on the slip. */
export async function getReturn(returnNo: string, db: Tx | typeof prisma = prisma) {
  const rows = await db.posReturn.findMany({ where: { returnNo }, orderBy: { id: "asc" }, include: { shift: { select: { shiftNo: true } } } });
  if (rows.length === 0) throw AppError.notFound(`No return ${returnNo}`);
  const lines = mapRows(rows, await staffNames(rows.map((row) => row.createdById), db));
  const member = rows[0].customerId
    ? await db.posCustomer.findUnique({ where: { id: rows[0].customerId }, select: { loyaltyPoints: true, walletBalance: true } })
    : null;
  return {
    returnNo,
    type: rows[0].type,
    typeLabel: TYPE_LABELS[rows[0].type] ?? rows[0].type,
    time: rows[0].createdAt,
    billNo: rows[0].invoiceGroupCode,
    customer: rows[0].customerName,
    mobile: rows[0].customerMobile,
    refund: round2(rows.reduce((sum, row) => sum + row.refundAmount, 0)),
    refundMethod: rows[0].refundMethod,
    pointsReversed: rows.reduce((sum, row) => sum + row.pointsReversed, 0),
    memberAfter: member ? { points: member.loyaltyPoints, wallet: round2(member.walletBalance) } : null,
    reason: rows[0].reason,
    note: rows[0].note,
    disposal: rows[0].disposal,
    disposalLabel: lines[0].disposalLabel,
    reference: rows[0].reference,
    shiftNo: lines[0].shiftNo,
    by: lines[0].by,
    lines,
  };
}

export async function listReturns(q: { page: number; limit: number; type?: ReturnType; from?: string; to?: string; search?: string }, branchId: number | null) {
  const where: Prisma.PosReturnWhereInput = {
    ...(branchId ? { branchId } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999`) } : {}) } } : {}),
    ...(q.search ? { OR: [
      { returnNo: { contains: q.search, mode: "insensitive" } },
      { productName: { contains: q.search, mode: "insensitive" } },
      { invoiceGroupCode: { contains: q.search, mode: "insensitive" } },
      { customerName: { contains: q.search, mode: "insensitive" } },
      { customerMobile: { contains: q.search } },
    ] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.posReturn.count({ where }),
    prisma.posReturn.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.limit, take: q.limit, include: { shift: { select: { shiftNo: true } } } }),
  ]);
  return { total, rows: mapRows(rows, await staffNames(rows.map((row) => row.createdById))) };
}

/** Damaged stock kept aside right now, and today's totals, for the top of the page. */
export async function getOverview(branchId: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [damagedHere, today] = await Promise.all([
    prisma.branchStock.findMany({ where: { branchId, damagedQuantity: { gt: 0 } }, select: { productId: true } }),
    prisma.posReturn.findMany({ where: { createdAt: { gte: start }, branchId }, select: { type: true, quantity: true, refundAmount: true, refundMethod: true, returnNo: true } }),
  ]);
  // This branch's damaged stock (quantity = its shelf, damagedQuantity = kept aside here).
  const damaged = await forBranch(branchId, await prisma.inventoryProduct.findMany({ where: { id: { in: damagedHere.map((row) => row.productId) } }, select: { ...PRODUCT_SELECT, emptyBottlesOnHand: true }, orderBy: { name: "asc" } }));
  const damagedRows = damaged.map((product) => {
    const cost = unitCostOf(product);
    return { productId: product.id, name: productLabel(product), damaged: product.damagedQuantity, inStock: product.quantity, unitCost: cost, value: cost == null ? null : round2(cost * product.damagedQuantity) };
  });
  const sum = (type: string) => today.filter((row) => row.type === type).reduce((total, row) => total + row.quantity, 0);
  return {
    damagedStock: damagedRows,
    damagedUnits: damagedRows.reduce((total, row) => total + row.damaged, 0),
    damagedValue: round2(damagedRows.reduce((total, row) => total + (row.value ?? 0), 0)),
    today: {
      exchanged: sum("EXCHANGE"),
      returned: sum("REFUND"),
      refunds: new Set(today.filter((row) => row.type === "REFUND").map((row) => row.returnNo)).size,
      refundCash: round2(today.filter((row) => row.refundMethod === "CASH").reduce((total, row) => total + row.refundAmount, 0)),
      refundWallet: round2(today.filter((row) => row.refundMethod === "WALLET").reduce((total, row) => total + row.refundAmount, 0)),
      storeDamaged: sum("STORE_DAMAGE"),
      cleared: sum("DAMAGE_CLEARED"),
    },
  };
}
