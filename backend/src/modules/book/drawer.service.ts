import type { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { findOpenShift } from "./stock-movements";

/**
 * "No sale" drawer opens. Opening the cash drawer without a bill is a classic way to take cash
 * unseen, so every press of "Open drawer" is saved with who, when, branch, shift and a reason.
 * (The drawer opening for a cash bill needs no record of its own: the bill is the record.)
 */
async function nextOpenNo(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(740321)");
  const last = await tx.posDrawerOpen.findFirst({ orderBy: { id: "desc" }, select: { openNo: true } });
  return `NS-${String((last ? Number(last.openNo.replace(/\D/g, "")) : 0) + 1).padStart(6, "0")}`;
}

export async function recordDrawerOpen(reason: string, actorId: number, branchId: number) {
  return prisma.$transaction(async (tx) => {
    const shift = await findOpenShift(tx, branchId);
    if (!shift) throw AppError.validation({ reason: ["No shift is open at this branch — start a shift before opening the cash drawer"] });
    const admin = await tx.posAdmin.findUnique({ where: { id: actorId }, select: { name: true } });
    const open = await tx.posDrawerOpen.create({
      data: { openNo: await nextOpenNo(tx), branchId, shiftId: shift.id, reason, createdById: actorId },
    });
    return { ...open, shiftNo: shift.shiftNo, openedBy: admin?.name ?? null };
  });
}

/** The no-sale opens of one shift, oldest first, with who opened the drawer. */
export async function shiftDrawerOpens(shiftId: number) {
  const rows = await prisma.posDrawerOpen.findMany({ where: { shiftId }, orderBy: { createdAt: "asc" } });
  const names = await adminNames(rows.map((row) => row.createdById));
  return rows.map((row) => ({
    openNo: row.openNo,
    at: row.createdAt,
    reason: row.reason,
    openedBy: names.get(row.createdById) ?? "Unknown",
  }));
}

/** No-sale opens between two dates, counted per staff member (for period reports). */
export async function drawerOpensInPeriod(start: Date, end: Date, branchId: number | null) {
  const rows = await prisma.posDrawerOpen.findMany({
    where: { createdAt: { gte: start, lt: end }, ...(branchId == null ? {} : { branchId }) },
    select: { createdById: true },
  });
  const names = await adminNames(rows.map((row) => row.createdById));
  const byStaff = new Map<number, number>();
  for (const row of rows) byStaff.set(row.createdById, (byStaff.get(row.createdById) ?? 0) + 1);
  return {
    count: rows.length,
    byStaff: [...byStaff].map(([id, count]) => ({ name: names.get(id) ?? "Unknown", count })).sort((a, b) => b.count - a.count),
  };
}

async function adminNames(ids: number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<number, string>();
  const admins = await prisma.posAdmin.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(admins.map((admin) => [admin.id, admin.name]));
}
