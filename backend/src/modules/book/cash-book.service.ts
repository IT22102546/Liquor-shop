import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { findOpenShift } from "./stock-movements";

export type CashDirection = "IN" | "OUT";
export type CashSource = "DRAWER" | "BANK" | "OWNER";

/** Money out (vouchers): everyday bar expenses. */
export const EXPENSE_CATEGORIES: Record<string, string> = {
  PETROL: "Petrol & transport",
  ICE: "Ice",
  STOCK_PURCHASE: "Stock purchase (supplier)",
  WAGES: "Staff wages",
  STAFF_ADVANCE: "Staff advance",
  ELECTRICITY: "Electricity",
  WATER: "Water",
  RENT: "Rent",
  EXCISE: "Excise licence & fees",
  REPAIRS: "Repairs & maintenance",
  CLEANING: "Cleaning & supplies",
  BANK_CHARGES: "Bank charges",
  OTHER: "Other expense",
};

/** Money in (receipts). Shift takings and card settlement are created automatically at shift close. */
export const INCOME_CATEGORIES: Record<string, string> = {
  SHIFT_TAKINGS: "Shift takings (cash)",
  CARD_SETTLEMENT: "Card sales (card machine)",
  TRANSFER_SALES: "Bank transfer / QR sales",
  EMPTIES_REFUND: "Empty bottle refund (supplier)",
  OWNER_CASH_IN: "Owner cash in / float top-up",
  OTHER_INCOME: "Other income",
};
const AUTOMATIC_ONLY = new Set(["SHIFT_TAKINGS", "CARD_SETTLEMENT", "TRANSFER_SALES"]);

export const SOURCE_LABELS: Record<string, string> = {
  DRAWER: "Cash drawer",
  BANK: "Bank",
  OWNER: "Owner",
  // Shift-close takings before they are banked:
  SAFE: "Safe (not banked yet)",
  CARD: "Card company (not in bank yet)",
};
/** Where shift-close takings sit until someone marks them as banked. */
export const HOLDING_SOURCE: Record<string, string> = { SHIFT_TAKINGS: "SAFE", CARD_SETTLEMENT: "CARD", TRANSFER_SALES: "BANK" };

const round2 = (value: number) => Math.round(value * 100) / 100;

async function nextEntryNo(db: Prisma.TransactionClient, direction: CashDirection) {
  const prefix = direction === "OUT" ? "VCH" : "RCP";
  const count = await db.posCashEntry.count({ where: { direction } });
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

/** Cash in the drawer right now: float + cash sales + cash in − cash out (for the open shift). */
export async function drawerCash(shiftId: number, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const [shift, cashSales, drawerIn, drawerOut] = await Promise.all([
    db.posShift.findUniqueOrThrow({ where: { id: shiftId }, select: { openingFloat: true } }),
    db.posCounterSale.aggregate({ where: { shiftId, paymentMethod: "CASH" }, _sum: { totalAmount: true } }),
    db.posCashEntry.aggregate({ where: { shiftId, source: "DRAWER", direction: "IN", voided: false }, _sum: { amount: true } }),
    db.posCashEntry.aggregate({ where: { shiftId, source: "DRAWER", direction: "OUT", voided: false }, _sum: { amount: true } }),
  ]);
  return round2(shift.openingFloat + (cashSales._sum.totalAmount ?? 0) + (drawerIn._sum.amount ?? 0) - (drawerOut._sum.amount ?? 0));
}

export type CreateCashEntryDto = {
  direction: CashDirection;
  category: string;
  amount: number;
  source: CashSource;
  party?: string;
  reference?: string;
  note?: string;
  entryDate?: string;
};

export async function createCashEntry(dto: CreateCashEntryDto, actorId: number) {
  const categories = dto.direction === "OUT" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  if (!categories[dto.category] || AUTOMATIC_ONLY.has(dto.category)) {
    throw AppError.validation({ category: ["Choose a category from the list"] });
  }
  if (dto.direction === "IN" && dto.source === "OWNER") {
    throw AppError.validation({ source: ["Money in goes into the cash drawer or the bank"] });
  }

  const created = await prisma.$transaction(async (tx) => {
    let shiftId: number | null = null;
    if (dto.source === "DRAWER") {
      const shift = await findOpenShift(tx);
      if (!shift) throw AppError.validation({ source: ["No shift is open — start a shift to pay from or into the cash drawer"] });
      shiftId = shift.id;
      if (dto.direction === "OUT") {
        const available = await drawerCash(shift.id, tx);
        if (dto.amount > available + 0.001) {
          throw AppError.validation({ amount: [`Only Rs. ${available.toLocaleString("en-LK", { minimumFractionDigits: 2 })} should be in the drawer`] });
        }
      }
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await tx.posCashEntry.create({
          data: {
            entryNo: await nextEntryNo(tx, dto.direction),
            direction: dto.direction,
            category: dto.category,
            amount: round2(dto.amount),
            source: dto.source,
            party: dto.party?.trim() || null,
            reference: dto.reference?.trim() || null,
            note: dto.note?.trim() || null,
            entryDate: dto.entryDate ? new Date(`${dto.entryDate}T12:00:00`) : new Date(),
            shiftId,
            createdById: actorId,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
        throw error;
      }
    }
    throw new AppError("Could not number the entry — please try again", 409);
  });
  return getCashEntry(created.id);
}

/** One entry with its labels and staff names — the same shape the list returns (used for printing). */
export async function getCashEntry(id: number) {
  const entry = await prisma.posCashEntry.findUnique({ where: { id }, include: { shift: { select: { shiftNo: true, status: true } } } });
  if (!entry) throw AppError.notFound("Entry not found");
  const staff = await prisma.posAdmin.findMany({ where: { id: { in: [entry.createdById, entry.voidedById, entry.bankedById].filter((v): v is number => Boolean(v)) } }, select: { id: true, name: true, role: true } });
  const byId = new Map(staff.map((member) => [member.id, member]));
  const labels = entry.direction === "OUT" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return {
    ...entry,
    categoryLabel: labels[entry.category] ?? entry.category,
    sourceLabel: SOURCE_LABELS[entry.source as CashSource] ?? entry.source,
    createdBy: byId.get(entry.createdById) ?? null,
    voidedBy: entry.voidedById ? byId.get(entry.voidedById) ?? null : null,
    bankedBy: entry.bankedById ? byId.get(entry.bankedById) ?? null : null,
  };
}

/**
 * Marks shift takings as banked: cash deposited from the safe, or card / QR money seen in the bank.
 * Several entries can go on one deposit slip (e.g. two shifts' cash banked together).
 */
export async function markBanked(ids: number[], reference: string | undefined, date: string | undefined, actorId: number) {
  const entries = await prisma.posCashEntry.findMany({ where: { id: { in: ids } } });
  if (entries.length !== ids.length) throw AppError.notFound("Some entries were not found");
  const notPending = entries.filter((entry) => entry.bankStatus !== "PENDING" || entry.voided);
  if (notPending.length) throw new AppError(`${notPending.map((entry) => entry.entryNo).join(", ")} ${notPending.length === 1 ? "is" : "are"} not waiting to be banked`, 400);
  const bankedAt = date ? new Date(`${date}T12:00:00`) : new Date();
  await prisma.posCashEntry.updateMany({
    where: { id: { in: ids }, bankStatus: "PENDING" },
    data: { bankStatus: "BANKED", bankedAt, bankedById: actorId, bankReference: reference?.trim() || null, source: "BANK" },
  });
  const updated = await Promise.all(ids.map((id) => getCashEntry(id)));
  return { entries: updated, count: updated.length, amount: round2(updated.reduce((sum, entry) => sum + entry.amount, 0)), reference: reference?.trim() || null };
}

/** Undo a mistaken "banked" mark: the entry goes back to waiting (in the safe / with the card company). */
export async function unmarkBanked(id: number) {
  const entry = await prisma.posCashEntry.findUnique({ where: { id } });
  if (!entry) throw AppError.notFound("Entry not found");
  if (entry.bankStatus !== "BANKED") throw new AppError("This entry is not marked as banked", 400);
  await prisma.posCashEntry.update({
    where: { id },
    data: { bankStatus: "PENDING", bankedAt: null, bankedById: null, bankReference: null, source: HOLDING_SOURCE[entry.category] ?? "SAFE" },
  });
  return getCashEntry(id);
}

/** Voided entries stay in the book (crossed out) with who voided them and why. */
export async function voidCashEntry(id: number, reason: string, actorId: number) {
  const entry = await prisma.posCashEntry.findUnique({ where: { id }, include: { shift: { select: { status: true, shiftNo: true } } } });
  if (!entry) throw AppError.notFound("Entry not found");
  if (entry.voided) throw new AppError("This entry is already voided", 400);
  if (entry.automatic) throw new AppError("Entries made by a shift close can't be voided", 400);
  if (entry.shift && entry.shift.status === "CLOSED") {
    throw new AppError(`Shift ${entry.shift.shiftNo} is closed and its Z report is locked — record a correcting entry instead`, 400);
  }
  await prisma.posCashEntry.update({
    where: { id },
    data: { voided: true, voidReason: reason.trim(), voidedById: actorId, voidedAt: new Date() },
  });
  return getCashEntry(id);
}

export type CashEntryQuery = {
  direction: CashDirection;
  page: number;
  limit: number;
  category?: string;
  source?: CashSource;
  from?: string;
  to?: string;
  search?: string;
  shiftId?: number;
  bankStatus?: "PENDING" | "BANKED";
};

export async function listCashEntries(query: CashEntryQuery) {
  const search = query.search?.trim();
  const where: Prisma.PosCashEntryWhereInput = {
    direction: query.direction,
    ...(query.category ? { category: query.category } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.shiftId ? { shiftId: query.shiftId } : {}),
    ...(query.bankStatus ? { bankStatus: query.bankStatus } : {}),
    ...(query.from || query.to
      ? { entryDate: { ...(query.from ? { gte: new Date(`${query.from}T00:00:00`) } : {}), ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999`) } : {}) } }
      : {}),
    ...(search
      ? { OR: [
          { entryNo: { contains: search, mode: "insensitive" } },
          { party: { contains: search, mode: "insensitive" } },
          { reference: { contains: search, mode: "insensitive" } },
          { note: { contains: search, mode: "insensitive" } },
        ] }
      : {}),
  };
  const [entries, total, byCategory, pending] = await Promise.all([
    prisma.posCashEntry.findMany({
      where,
      orderBy: [{ entryDate: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { shift: { select: { shiftNo: true, status: true } } },
    }),
    prisma.posCashEntry.count({ where }),
    prisma.posCashEntry.groupBy({ by: ["category"], where: { ...where, voided: false }, _sum: { amount: true }, _count: true }),
    // Everything still waiting to be banked, whatever the filters (it's a to-do list).
    prisma.posCashEntry.groupBy({ by: ["category"], where: { direction: query.direction, bankStatus: "PENDING", voided: false }, _sum: { amount: true }, _count: true }),
  ]);

  const staffIds = [...new Set(entries.flatMap((entry) => [entry.createdById, entry.voidedById, entry.bankedById]).filter((id): id is number => Boolean(id)))];
  const staff = await prisma.posAdmin.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true, role: true } });
  const staffById = new Map(staff.map((member) => [member.id, member]));
  const labels = query.direction === "OUT" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return {
    entries: entries.map((entry) => ({
      ...entry,
      categoryLabel: labels[entry.category] ?? entry.category,
      sourceLabel: SOURCE_LABELS[entry.source as CashSource] ?? entry.source,
      createdBy: staffById.get(entry.createdById) ?? null,
      voidedBy: entry.voidedById ? staffById.get(entry.voidedById) ?? null : null,
      bankedBy: entry.bankedById ? staffById.get(entry.bankedById) ?? null : null,
    })),
    pending: {
      amount: round2(pending.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0)),
      count: pending.reduce((sum, row) => sum + row._count, 0),
      byCategory: pending.map((row) => ({ category: row.category, label: labels[row.category] ?? row.category, amount: round2(row._sum.amount ?? 0), count: row._count })),
    },
    totals: {
      amount: round2(byCategory.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0)),
      byCategory: byCategory
        .map((row) => ({ category: row.category, label: labels[row.category] ?? row.category, amount: round2(row._sum.amount ?? 0), count: row._count }))
        .sort((a, b) => b.amount - a.amount),
    },
    categories: Object.entries(labels).map(([value, label]) => ({ value, label, automatic: AUTOMATIC_ONLY.has(value) })),
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  };
}
