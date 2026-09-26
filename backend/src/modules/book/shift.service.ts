import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { EXPENSE_CATEGORIES, HOLDING_SOURCE, INCOME_CATEGORIES, SOURCE_LABELS } from "./cash-book.service";
import { findOpenShift } from "./stock-movements";

/** Sri Lankan notes and coins counted at the till. */
export const DENOMINATIONS = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 2, 1] as const;

const round2 = (value: number) => Math.round(value * 100) / 100;
const PAYMENT_LABELS: Record<string, string> = { CASH: "Cash", CARD: "Card", BANK_TRANSFER: "Transfer / QR", CHEQUE: "Cheque" };
/** Card = card machine; everything else that isn't cash (bank transfer, QR, cheque) is checked in the bank. */
const kindOf = (method: string) => (method === "CASH" ? "cash" : method === "CARD" ? "card" : "transfer");

async function staffNames(ids: Array<number | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is number => Boolean(id)))];
  const staff = await prisma.posAdmin.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, role: true } });
  return new Map(staff.map((member) => [member.id, member]));
}

/**
 * Everything the Z report needs for one shift: every bill with who made it, totals by payment and by
 * staff member, discounts, points, empties, drawer cash in/out, expected cash and the stock day book.
 */
export async function summarizeShift(shiftId: number) {
  const shift = await prisma.posShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw AppError.notFound("Shift not found");

  const [sales, entries, movements, products] = await Promise.all([
    prisma.posCounterSale.findMany({
      where: { shiftId },
      orderBy: { createdAt: "asc" },
      include: { cashier: { select: { id: true, name: true, role: true } }, customer: { select: { firstName: true, lastName: true } } },
    }),
    prisma.posCashEntry.findMany({ where: { shiftId }, orderBy: { entryDate: "asc" } }),
    prisma.inventoryMovement.findMany({ where: { shiftId } }),
    prisma.inventoryProduct.findMany({
      select: { id: true, name: true, compatibleWith: true, quantity: true, emptyBottlesOnHand: true, sellingPrice: true, brand: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: [{ categoryId: "asc" }, { name: "asc" }],
    }),
  ]);
  const lines = await prisma.posCustomerPurchase.findMany({
    where: { invoiceGroupCode: { in: sales.map((sale) => sale.invoiceGroupCode) } },
    select: { invoiceGroupCode: true, quantity: true, finalSellingPrice: true, billDiscount: true, inventoryProduct: { select: { id: true, name: true } } },
  });
  const staff = await staffNames([shift.openedById, shift.countedById, shift.closedById, ...entries.map((entry) => entry.createdById), ...entries.map((entry) => entry.voidedById)]);

  // ── Sales ──
  const bills = sales.map((sale) => {
    const items = lines.filter((line) => line.invoiceGroupCode === sale.invoiceGroupCode);
    return {
      billNo: sale.invoiceGroupCode,
      time: sale.createdAt,
      cashier: sale.cashier.name,
      customer: sale.customer ? [sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(" ") : "Walk-in",
      payment: PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod,
      reference: sale.paymentReference,
      items: items.map((line) => `${line.quantity} × ${line.inventoryProduct?.name ?? "Item"}`).join(", "),
      units: items.reduce((sum, line) => sum + line.quantity, 0),
      emptyDeduction: sale.emptyDeduction,
      discount: round2(sale.discountAmount + sale.pointsValue),
      total: sale.totalAmount,
    };
  });
  const cashSales = round2(sales.filter((sale) => sale.paymentMethod === "CASH").reduce((sum, sale) => sum + sale.totalAmount, 0));
  const cardSales = round2(sales.filter((sale) => kindOf(sale.paymentMethod) === "card").reduce((sum, sale) => sum + sale.totalAmount, 0));
  const transferSales = round2(sales.filter((sale) => kindOf(sale.paymentMethod) === "transfer").reduce((sum, sale) => sum + sale.totalAmount, 0));
  const netSales = round2(cashSales + cardSales + transferSales);
  // Non-cash payments are recorded automatically at the till; listed so they can be ticked off
  // against the card machine settlement slip and the bank app.
  const paymentList = (kind: "card" | "transfer") => sales
    .filter((sale) => kindOf(sale.paymentMethod) === kind)
    .map((sale) => ({ billNo: sale.invoiceGroupCode, time: sale.createdAt, cashier: sale.cashier.name, amount: sale.totalAmount, reference: sale.paymentReference, method: PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod }));
  const cardPayments = paymentList("card");
  const transferPayments = paymentList("transfer");
  const emptyDeduction = round2(sales.reduce((sum, sale) => sum + sale.emptyDeduction, 0));
  const discounts = round2(sales.reduce((sum, sale) => sum + sale.discountAmount, 0));
  const pointsValue = round2(sales.reduce((sum, sale) => sum + sale.pointsValue, 0));
  const pointsRedeemed = sales.reduce((sum, sale) => sum + sale.pointsRedeemed, 0);
  const grossSales = round2(netSales + emptyDeduction + discounts + pointsValue);

  const byStaffMap = new Map<string, { name: string; bills: number; cash: number; card: number; transfer: number; total: number }>();
  sales.forEach((sale) => {
    const entry = byStaffMap.get(sale.cashier.name) ?? { name: sale.cashier.name, bills: 0, cash: 0, card: 0, transfer: 0, total: 0 };
    entry.bills += 1;
    entry.total = round2(entry.total + sale.totalAmount);
    const kind = kindOf(sale.paymentMethod);
    entry[kind] = round2(entry[kind] + sale.totalAmount);
    byStaffMap.set(sale.cashier.name, entry);
  });

  const byProductMap = new Map<number, { name: string; units: number; amount: number }>();
  lines.forEach((line) => {
    if (!line.inventoryProduct) return;
    const entry = byProductMap.get(line.inventoryProduct.id) ?? { name: line.inventoryProduct.name, units: 0, amount: 0 };
    entry.units += line.quantity;
    entry.amount = round2(entry.amount + line.finalSellingPrice);
    byProductMap.set(line.inventoryProduct.id, entry);
  });

  // ── Cash book (drawer in/out and bank/owner entries made during the shift) ──
  const cashEntries = entries.map((entry) => ({
    entryNo: entry.entryNo,
    direction: entry.direction,
    category: (entry.direction === "OUT" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[entry.category] ?? entry.category,
    source: SOURCE_LABELS[entry.source] ?? entry.source,
    fromDrawer: entry.source === "DRAWER",
    amount: entry.amount,
    party: entry.party,
    note: entry.note,
    reference: entry.reference,
    time: entry.entryDate,
    recordedBy: staff.get(entry.createdById)?.name ?? "—",
    voided: entry.voided,
    voidReason: entry.voidReason,
    voidedBy: entry.voidedById ? staff.get(entry.voidedById)?.name ?? "—" : null,
    automatic: entry.automatic,
  }));
  const live = cashEntries.filter((entry) => !entry.voided && !entry.automatic);
  const drawerIn = round2(live.filter((entry) => entry.fromDrawer && entry.direction === "IN").reduce((sum, entry) => sum + entry.amount, 0));
  const drawerOut = round2(live.filter((entry) => entry.fromDrawer && entry.direction === "OUT").reduce((sum, entry) => sum + entry.amount, 0));
  const expensesAll = round2(live.filter((entry) => entry.direction === "OUT").reduce((sum, entry) => sum + entry.amount, 0));
  const expectedCash = round2(shift.openingFloat + cashSales + drawerIn - drawerOut);

  // ── Stock day book: opening + received ± adjusted − sold = closing (per product) ──
  const stockMoves = new Map<number, { received: number; sold: number; adjusted: number; opening: number }>();
  const emptyMoves = new Map<number, { collected: number; returned: number }>();
  movements.forEach((movement) => {
    if (movement.kind === "STOCK") {
      const entry = stockMoves.get(movement.productId) ?? { received: 0, sold: 0, adjusted: 0, opening: 0 };
      if (movement.type === "RECEIVED") entry.received += movement.quantity;
      else if (movement.type === "SOLD") entry.sold += -movement.quantity;
      else if (movement.type === "OPENING") entry.opening += movement.quantity;
      else entry.adjusted += movement.quantity;
      stockMoves.set(movement.productId, entry);
    } else {
      const entry = emptyMoves.get(movement.productId) ?? { collected: 0, returned: 0 };
      if (movement.type === "COLLECTED") entry.collected += movement.quantity;
      if (movement.type === "RETURNED") entry.returned += -movement.quantity;
      emptyMoves.set(movement.productId, entry);
    }
  });
  const stockBook = products.map((product) => {
    const moves = stockMoves.get(product.id) ?? { received: 0, sold: 0, adjusted: 0, opening: 0 };
    const closing = product.quantity;
    // New products added during the shift count their opening stock as "received" today.
    const received = moves.received + moves.opening;
    const opening = closing - received - moves.adjusted + moves.sold;
    return {
      productId: product.id,
      name: product.name,
      size: product.compatibleWith,
      brand: product.brand.name,
      category: product.category.name,
      opening,
      received,
      sold: moves.sold,
      adjusted: moves.adjusted,
      closing,
    };
  });
  const empties = products
    .map((product) => {
      const moves = emptyMoves.get(product.id) ?? { collected: 0, returned: 0 };
      return { name: product.name, collected: moves.collected, returned: moves.returned, onHand: product.emptyBottlesOnHand };
    })
    .filter((row) => row.collected || row.returned || row.onHand);

  return {
    shift: {
      id: shift.id,
      shiftNo: shift.shiftNo,
      status: shift.status,
      openedAt: shift.openedAt,
      openedBy: staff.get(shift.openedById)?.name ?? "—",
      openingFloat: shift.openingFloat,
      countedAt: shift.countedAt,
      countedBy: shift.countedById ? staff.get(shift.countedById)?.name ?? "—" : null,
      closedAt: shift.closedAt,
      closedBy: shift.closedById ? staff.get(shift.closedById)?.name ?? "—" : null,
    },
    sales: {
      bills: sales.length,
      units: bills.reduce((sum, bill) => sum + bill.units, 0),
      grossSales,
      emptyDeduction,
      emptiesReturned: sales.reduce((sum, sale) => sum + sale.emptiesReturned, 0),
      discounts,
      pointsRedeemed,
      pointsValue,
      netSales,
      cashSales,
      cardSales,
      transferSales,
      cardPayments,
      transferPayments,
      byStaff: [...byStaffMap.values()].sort((a, b) => b.total - a.total),
      byProduct: [...byProductMap.values()].sort((a, b) => b.amount - a.amount),
      billList: bills,
    },
    cash: {
      openingFloat: shift.openingFloat,
      cashSales,
      drawerIn,
      drawerOut,
      expectedCash,
      expensesAll,
      entries: cashEntries,
    },
    stockBook,
    empties,
  };
}

export type ShiftSummary = Awaited<ReturnType<typeof summarizeShift>>;

async function nextShiftNo(db: Prisma.TransactionClient) {
  const count = await db.posShift.count();
  return `SH-${String(count + 1).padStart(5, "0")}`;
}

export async function getCurrentShift() {
  const open = await findOpenShift();
  const lastClosed = await prisma.posShift.findFirst({ where: { status: "CLOSED" }, orderBy: { closedAt: "desc" }, select: { floatLeft: true, shiftNo: true, closedAt: true } });
  return { open: open ? { id: open.id, shiftNo: open.shiftNo, openedAt: open.openedAt, openingFloat: open.openingFloat, counted: open.countedAt != null } : null, suggestedFloat: lastClosed?.floatLeft ?? 0, lastClosed };
}

export async function openShift(openingFloat: number, actorId: number) {
  return prisma.$transaction(async (tx) => {
    const open = await findOpenShift(tx);
    if (open) throw new AppError(`Shift ${open.shiftNo} is already open — close it first`, 409);
    return tx.posShift.create({ data: { shiftNo: await nextShiftNo(tx), openedById: actorId, openingFloat: round2(openingFloat) } });
  });
}

/**
 * Blind count: the counted cash is saved first; only then is the expected amount returned.
 * A recount is allowed while the shift is open — the first count is kept in the history.
 */
export async function countShift(shiftId: number, counts: Record<string, number>, actorId: number) {
  const shift = await prisma.posShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw AppError.notFound("Shift not found");
  if (shift.status !== "OPEN") throw new AppError("This shift is already closed", 400);

  const clean: Record<string, number> = {};
  DENOMINATIONS.forEach((note) => {
    const quantity = Math.max(0, Math.floor(Number(counts[String(note)] ?? 0)));
    if (quantity) clean[String(note)] = quantity;
  });
  const counted = round2(DENOMINATIONS.reduce((sum, note) => sum + note * (clean[String(note)] ?? 0), 0));
  const summary = await summarizeShift(shiftId);
  const previous = (shift.denominations && typeof shift.denominations === "object" ? shift.denominations : {}) as { history?: unknown[] };
  const history = [...(Array.isArray(previous.history) ? previous.history : []), { total: counted, at: new Date().toISOString(), byId: actorId }];

  await prisma.posShift.update({
    where: { id: shiftId },
    data: {
      countedCash: counted,
      denominations: { counts: clean, history } as Prisma.InputJsonValue,
      countedById: actorId,
      countedAt: new Date(),
      expectedCash: summary.cash.expectedCash,
      cashDifference: round2(counted - summary.cash.expectedCash),
    },
  });
  return {
    countedCash: counted,
    expectedCash: summary.cash.expectedCash,
    difference: round2(counted - summary.cash.expectedCash),
    cardSales: summary.sales.cardSales,
    transferSales: summary.sales.transferSales,
    recounts: history.length - 1,
  };
}

export type CloseShiftDto = {
  floatLeft: number;
  differenceReason?: string;
  cardSlipTotal?: number;
  /** Required when the settlement slip doesn't match; also used for "not settled yet". */
  cardDifferenceReason?: string;
  notes?: string;
  stockCounts?: Array<{ productId: number; counted: number }>;
};

/** Locks the shift: records takings in the cash book and freezes the Z report. */
export async function closeShift(shiftId: number, dto: CloseShiftDto, actorId: number) {
  const shift = await prisma.posShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw AppError.notFound("Shift not found");
  if (shift.status !== "OPEN") throw new AppError("This shift is already closed", 400);
  if (shift.countedCash == null || !shift.countedAt) throw AppError.validation({ count: ["Count the cash in the drawer first"] });

  // Re-check against the latest figures (a sale or expense may have happened after the count).
  const summary = await summarizeShift(shiftId);
  const difference = round2(shift.countedCash - summary.cash.expectedCash);
  if (Math.abs(difference) >= 0.01 && !dto.differenceReason?.trim()) {
    throw AppError.validation({ differenceReason: [`The drawer is ${difference > 0 ? "over" : "short"} by Rs. ${Math.abs(difference).toLocaleString("en-LK", { minimumFractionDigits: 2 })} — give a reason`] });
  }
  if (dto.floatLeft < 0 || dto.floatLeft > shift.countedCash + 0.001) {
    throw AppError.validation({ floatLeft: ["Float left can't be more than the cash counted"] });
  }
  const cardDifference = dto.cardSlipTotal != null ? round2(dto.cardSlipTotal - summary.sales.cardSales) : null;
  if (cardDifference != null && Math.abs(cardDifference) >= 0.01 && !dto.cardDifferenceReason?.trim()) {
    throw AppError.validation({ cardDifferenceReason: [`The card machine total is ${cardDifference > 0 ? "more" : "less"} than the card sales by Rs. ${Math.abs(cardDifference).toLocaleString("en-LK", { minimumFractionDigits: 2 })} — give a reason`] });
  }
  const cardDifferenceReason = dto.cardDifferenceReason?.trim() || null;
  const cashBanked = round2(shift.countedCash - dto.floatLeft);
  const productById = new Map(summary.stockBook.map((row) => [row.productId, row]));
  const stockCount = (dto.stockCounts ?? [])
    .filter((row) => productById.has(row.productId) && Number.isFinite(row.counted))
    .map((row) => {
      const book = productById.get(row.productId)!;
      return { name: book.name, system: book.closing, counted: Math.floor(row.counted), difference: Math.floor(row.counted) - book.closing };
    });

  const closedAt = new Date();
  const report = {
    ...summary,
    shift: { ...summary.shift, status: "CLOSED", closedAt, closedBy: (await staffNames([actorId])).get(actorId)?.name ?? "—" },
    close: {
      countedCash: shift.countedCash,
      denominations: shift.denominations,
      expectedCash: summary.cash.expectedCash,
      difference,
      differenceReason: dto.differenceReason?.trim() || null,
      cardSlipTotal: dto.cardSlipTotal ?? null,
      cardDifference,
      cardDifferenceReason,
      floatLeft: round2(dto.floatLeft),
      cashBanked,
      notes: dto.notes?.trim() || null,
      stockCount,
    },
  };

  return prisma.$transaction(async (tx) => {
    const stillOpen = await tx.posShift.updateMany({
      where: { id: shiftId, status: "OPEN" },
      data: {
        status: "CLOSED",
        closedById: actorId,
        closedAt,
        expectedCash: summary.cash.expectedCash,
        cashDifference: difference,
        differenceReason: dto.differenceReason?.trim() || null,
        cardSlipTotal: dto.cardSlipTotal ?? null,
        cardDifferenceReason,
        floatLeft: round2(dto.floatLeft),
        cashBanked,
        notes: dto.notes?.trim() || null,
        report: report as unknown as Prisma.InputJsonValue,
      },
    });
    if (stillOpen.count !== 1) throw new AppError("This shift was already closed", 409);

    // Takings go into the receipts book automatically.
    const receipts = [
      { category: "SHIFT_TAKINGS", amount: cashBanked, note: `Cash taken from the drawer at close of ${shift.shiftNo} (float left: Rs. ${round2(dto.floatLeft)}) — in the safe until deposited` },
      { category: "CARD_SETTLEMENT", amount: summary.sales.cardSales, note: `Card machine sales in ${shift.shiftNo} (${summary.sales.cardPayments.length} payment${summary.sales.cardPayments.length === 1 ? "" : "s"})${dto.cardSlipTotal != null ? ` · settlement slip Rs. ${dto.cardSlipTotal}` : " · not settled at close"}` },
      { category: "TRANSFER_SALES", amount: summary.sales.transferSales, note: `Bank transfer / QR sales in ${shift.shiftNo} (${summary.sales.transferPayments.length})` },
    ].filter((row) => row.amount > 0);
    let receiptCount = await tx.posCashEntry.count({ where: { direction: "IN" } });
    for (const receipt of receipts) {
      receiptCount += 1;
      await tx.posCashEntry.create({
        data: {
          entryNo: `RCP-${String(receiptCount).padStart(5, "0")}`,
          direction: "IN",
          category: receipt.category,
          amount: receipt.amount,
          // Not in the bank yet: waits in the safe / with the card company until marked as banked.
          source: HOLDING_SOURCE[receipt.category] ?? "SAFE",
          bankStatus: "PENDING",
          note: receipt.note,
          reference: shift.shiftNo,
          shiftId,
          automatic: true,
          createdById: actorId,
          entryDate: closedAt,
        },
      });
    }
    return { shiftNo: shift.shiftNo, report };
  });
}

export async function listShifts(page: number, limit: number) {
  const [shifts, total] = await Promise.all([
    prisma.posShift.findMany({ orderBy: { openedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.posShift.count(),
  ]);
  const staff = await staffNames(shifts.flatMap((shift) => [shift.openedById, shift.closedById]));
  return {
    shifts: shifts.map((shift) => {
      const report = shift.report as { sales?: { netSales?: number; bills?: number } } | null;
      return {
        id: shift.id,
        shiftNo: shift.shiftNo,
        status: shift.status,
        openedAt: shift.openedAt,
        openedBy: staff.get(shift.openedById)?.name ?? "—",
        closedAt: shift.closedAt,
        closedBy: shift.closedById ? staff.get(shift.closedById)?.name ?? "—" : null,
        openingFloat: shift.openingFloat,
        netSales: report?.sales?.netSales ?? null,
        bills: report?.sales?.bills ?? null,
        cashDifference: shift.cashDifference,
        cashBanked: shift.cashBanked,
      };
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/** Closed shifts return their frozen Z report; the open shift returns live figures. */
export async function getShiftReport(shiftId: number, revealCash: boolean) {
  const shift = await prisma.posShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw AppError.notFound("Shift not found");
  if (shift.status === "CLOSED" && shift.report) return { status: "CLOSED", report: shift.report };
  const summary = await summarizeShift(shiftId);
  if (revealCash || shift.countedAt) return { status: "OPEN", report: summary };
  // Blind count: until the drawer is counted, a cashier sees what was sold but no rupee totals
  // (bill totals would let them work out the expected cash before counting).
  return {
    status: "OPEN",
    blind: true,
    report: {
      ...summary,
      cash: { ...summary.cash, cashSales: null, expectedCash: null, drawerIn: null, drawerOut: null },
      sales: {
        ...summary.sales,
        grossSales: null, emptyDeduction: null, discounts: null, pointsValue: null, netSales: null, cashSales: null,
        // Card and transfer figures stay visible: they don't reveal the cash in the drawer.
        byStaff: summary.sales.byStaff.map((row) => ({ name: row.name, bills: row.bills, cash: null, card: row.card, transfer: row.transfer, total: null })),
        byProduct: summary.sales.byProduct.map((row) => ({ name: row.name, units: row.units, amount: null })),
        billList: summary.sales.billList.map((bill) => ({ ...bill, emptyDeduction: null, discount: null, total: null })),
      },
    },
  };
}
