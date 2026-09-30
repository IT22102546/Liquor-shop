import { randomInt } from "crypto";
import type { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { findOpenShift } from "../book/stock-movements";

/**
 * Gift vouchers: a fixed amount, used once and in full on a bill at any branch.
 *
 *  SOLD — the customer paid for it. The money comes in when it's issued (into that shift's drawer,
 *         card machine or bank checks) but it isn't a sale yet: the shop owes it until it's used.
 *  FREE — given by the shop (promotion, apology, reward). No money comes in; when it's used, its value
 *         is a promotion cost.
 *
 * Using a voucher is a payment on the bill (counted in sales like a wallet payment). The bill must be
 * at least the voucher's value; the rest is paid any other way.
 */
type Db = Prisma.TransactionClient | typeof prisma;

export const VOUCHER_KINDS = ["SOLD", "FREE"] as const;
export const VOUCHER_PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER"] as const;
export const PAYMENT_LABELS: Record<string, string> = { CASH: "Cash", CARD: "Card", BANK_TRANSFER: "Transfer / QR" };

const round2 = (value: number) => Math.round(value * 100) / 100;
const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// No 0/O or 1/I, so a code read out over the phone or typed from paper can't be mistaken.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")).join("-");

/** "7k3m 9qx2-ht4p" → "7K3M-9QX2-HT4P" (what staff type or the scanner reads). */
export function normalizeCode(input: string) {
  const plain = input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/I/g, "1");
  return plain.length === 12 ? `${plain.slice(0, 4)}-${plain.slice(4, 8)}-${plain.slice(8)}` : plain;
}
/** Only the last part of a code is shown in lists and on bills; the full code is the value. */
export const maskCode = (code: string) => `••••-••••-${code.slice(-4)}`;

/** Expiry is the end of the chosen day, Sri Lanka time. */
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999+05:30`);
const isExpired = (voucher: { status: string; expiresAt: Date | null }, now = new Date()) =>
  voucher.status === "ACTIVE" && voucher.expiresAt != null && voucher.expiresAt.getTime() < now.getTime();
export const displayStatus = (voucher: { status: string; expiresAt: Date | null }) => (isExpired(voucher) ? "EXPIRED" : voucher.status);

async function nextVoucherNo(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(740331)");
  const last = await tx.giftVoucher.findFirst({ orderBy: { id: "desc" }, select: { voucherNo: true } });
  return (last ? Number(last.voucherNo.replace(/\D/g, "")) : 0) + 1;
}

async function names(ids: Array<number | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is number => id != null))];
  const [admins] = await Promise.all([
    unique.length ? prisma.posAdmin.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } }) : [],
  ]);
  return new Map(admins.map((admin) => [admin.id, admin.name]));
}
async function branchNames() {
  const branches = await prisma.branch.findMany({ select: { id: true, name: true, code: true } });
  return new Map(branches.map((branch) => [branch.id, branch]));
}

type VoucherRow = Awaited<ReturnType<typeof prisma.giftVoucher.findFirst>> & {};

/** A voucher as the screens show it: names instead of ids, the status including "expired". */
async function present(rows: VoucherRow[], options: { fullCode?: boolean } = {}) {
  const [people, branches] = await Promise.all([
    names(rows.flatMap((row) => [row.issuedById, row.redeemedById, row.cancelledById])),
    branchNames(),
  ]);
  return rows.map((row) => ({
    id: row.id,
    voucherNo: row.voucherNo,
    code: options.fullCode ? row.code : maskCode(row.code),
    amount: row.amount,
    kind: row.kind,
    status: displayStatus(row),
    expiresAt: row.expiresAt,
    issuedTo: row.issuedTo,
    issuedPhone: row.issuedPhone,
    note: row.note,
    issuedAt: row.issuedAt,
    issuedBy: people.get(row.issuedById) ?? "—",
    issueBranch: row.issueBranchId ? branches.get(row.issueBranchId)?.name ?? "—" : "—",
    issueBranchId: row.issueBranchId,
    paymentMethod: row.paymentMethod,
    paymentLabel: row.paymentMethod ? PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod : null,
    paymentReference: row.paymentReference,
    redeemedAt: row.redeemedAt,
    redeemedBy: row.redeemedById ? people.get(row.redeemedById) ?? "—" : null,
    redeemedBranch: row.redeemedBranchId ? branches.get(row.redeemedBranchId)?.name ?? "—" : null,
    redeemedBranchId: row.redeemedBranchId,
    redeemedBillNo: row.redeemedBillNo,
    cancelledAt: row.cancelledAt,
    cancelledBy: row.cancelledById ? people.get(row.cancelledById) ?? "—" : null,
    cancelReason: row.cancelReason,
  }));
}
export type PresentedVoucher = Awaited<ReturnType<typeof present>>[number];

// ── Issue ──────────────────────────────────────────────────────────────────────
export type CreateVouchersDto = {
  amount: number;
  kind: (typeof VOUCHER_KINDS)[number];
  quantity: number;
  expiresOn?: string | null;
  issuedTo?: string | null;
  issuedPhone?: string | null;
  customerId?: number | null;
  note?: string | null;
  paymentMethod?: (typeof VOUCHER_PAYMENT_METHODS)[number] | null;
  paymentReference?: string | null;
};

export async function createVouchers(dto: CreateVouchersDto, actorId: number, branchId: number) {
  if (dto.kind === "SOLD" && !dto.paymentMethod) throw AppError.validation({ paymentMethod: ["Choose how the customer paid for the voucher"] });
  if (dto.kind === "FREE" && !(dto.note && dto.note.trim().length >= 3)) throw AppError.validation({ note: ["Say why the voucher is given free (e.g. promotion, apology)"] });
  const expiresAt = dto.expiresOn ? endOfDay(dto.expiresOn) : null;
  if (expiresAt && expiresAt.getTime() < Date.now()) throw AppError.validation({ expiresOn: ["The expiry date is already past"] });
  if (dto.customerId) {
    const member = await prisma.posCustomer.findUnique({ where: { id: dto.customerId }, select: { id: true } });
    if (!member) throw AppError.validation({ customerId: ["Loyalty member not found"] });
  }

  const created = await prisma.$transaction(async (tx) => {
    // Money for a SOLD voucher goes into this branch's open shift (drawer, card machine or bank check).
    const shift = await findOpenShift(tx, branchId);
    if (dto.kind === "SOLD" && !shift) {
      throw AppError.validation({ paymentMethod: ["No shift is open at this branch — start a shift so the money for the voucher is recorded in the Day End"] });
    }
    let number = await nextVoucherNo(tx);
    const rows = [];
    for (let index = 0; index < dto.quantity; index += 1) {
      let code = newCode();
      while (await tx.giftVoucher.findUnique({ where: { code }, select: { id: true } })) code = newCode();
      rows.push(await tx.giftVoucher.create({
        data: {
          voucherNo: `GV-${String(number).padStart(5, "0")}`,
          code,
          amount: round2(dto.amount),
          kind: dto.kind,
          expiresAt,
          issuedTo: dto.issuedTo?.trim() || null,
          issuedPhone: dto.issuedPhone?.trim() || null,
          customerId: dto.customerId ?? null,
          note: dto.note?.trim() || null,
          issuedById: actorId,
          issueBranchId: branchId,
          issueShiftId: shift?.id ?? null,
          paymentMethod: dto.kind === "SOLD" ? dto.paymentMethod! : null,
          paymentReference: dto.kind === "SOLD" && dto.paymentMethod !== "CASH" ? dto.paymentReference?.trim() || null : null,
        },
      }));
      number += 1;
    }
    return { rows, shiftNo: shift?.shiftNo ?? null };
  });
  const vouchers = await present(created.rows, { fullCode: true });
  return {
    vouchers,
    count: vouchers.length,
    total: round2(vouchers.reduce((sum, voucher) => sum + voucher.amount, 0)),
    kind: dto.kind,
    amount: round2(dto.amount),
    paymentMethod: dto.kind === "SOLD" ? dto.paymentMethod : null,
    shiftNo: created.shiftNo,
  };
}

// ── Look up / check at the counter ───────────────────────────────────────────
/** Why a code can't be used, in words the cashier can read out; null if it can. */
async function refusal(row: VoucherRow | null, input: string) {
  if (!row) return `No gift voucher with the code ${input}`;
  if (row.status === "REDEEMED") {
    const [shown] = await present([row]);
    return `${row.voucherNo} was already used on ${new Date(row.redeemedAt!).toLocaleString("en-GB", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" })} at ${shown.redeemedBranch} (bill ${row.redeemedBillNo})`;
  }
  if (row.status === "CANCELLED") return `${row.voucherNo} was cancelled${row.cancelReason ? `: ${row.cancelReason}` : ""}`;
  if (isExpired(row)) return `${row.voucherNo} expired on ${row.expiresAt!.toLocaleDateString("en-GB", { timeZone: "Asia/Colombo", dateStyle: "medium" })}`;
  return null;
}

export async function checkVoucher(input: string) {
  const code = normalizeCode(input);
  const row = await prisma.giftVoucher.findUnique({ where: { code } });
  const problem = await refusal(row, input.trim());
  if (problem) throw AppError.validation({ code: [problem] });
  const [shown] = await present([row!]);
  return { ...shown, code };
}

/** Vouchers entered on a bill: each must exist, be unused and not expired; duplicates count once. */
export async function vouchersForCheckout(inputs: string[]) {
  const codes = [...new Set(inputs.map(normalizeCode))];
  const rows = await prisma.giftVoucher.findMany({ where: { code: { in: codes } } });
  for (const code of codes) {
    const problem = await refusal(rows.find((row) => row.code === code) ?? null, code);
    if (problem) throw AppError.validation({ giftVouchers: [problem] });
  }
  return rows;
}

/**
 * Marks the bill's vouchers used, inside the sale's transaction. Only an ACTIVE, unexpired voucher
 * changes, so two tills using the same voucher at once can't both succeed.
 */
export async function redeemVouchers(tx: Prisma.TransactionClient, rows: VoucherRow[], use: { billNo: string; branchId: number; shiftId: number; actorId: number }) {
  const now = new Date();
  for (const row of rows) {
    const updated = await tx.giftVoucher.updateMany({
      where: { id: row.id, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      data: { status: "REDEEMED", redeemedAt: now, redeemedById: use.actorId, redeemedBranchId: use.branchId, redeemedShiftId: use.shiftId, redeemedBillNo: use.billNo },
    });
    if (updated.count !== 1) throw AppError.validation({ giftVouchers: [`${row.voucherNo} was just used or cancelled — take it off the bill`] });
  }
}

/** One voucher with its full code (administrators, to print it again). */
export async function getVoucherForPrint(id: number) {
  const row = await prisma.giftVoucher.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Gift voucher not found");
  const [shown] = await present([row], { fullCode: true });
  return shown;
}

// ── Cancel ───────────────────────────────────────────────────────────────────
export async function cancelVoucher(id: number, reason: string, actorId: number) {
  const row = await prisma.giftVoucher.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Gift voucher not found");
  if (row.status !== "ACTIVE") throw AppError.validation({ reason: [`${row.voucherNo} is ${row.status === "REDEEMED" ? "already used" : "already cancelled"} and can't be cancelled`] });
  const updated = await prisma.giftVoucher.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: actorId, cancelReason: reason },
  });
  if (updated.count !== 1) throw AppError.validation({ reason: [`${row.voucherNo} was just used — it can't be cancelled`] });
  const [shown] = await present([(await prisma.giftVoucher.findUnique({ where: { id } }))!]);
  return shown;
}

// ── List + totals ────────────────────────────────────────────────────────────
export async function listVouchers(q: {
  page: number; limit: number; status?: "ACTIVE" | "REDEEMED" | "CANCELLED" | "EXPIRED"; kind?: "SOLD" | "FREE";
  search?: string; branchId: number | null;
}) {
  const now = new Date();
  const statusWhere: Prisma.GiftVoucherWhereInput =
    q.status === "EXPIRED" ? { status: "ACTIVE", expiresAt: { lt: now } }
    : q.status === "ACTIVE" ? { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }
    : q.status ? { status: q.status } : {};
  const search = q.search?.trim();
  const where: Prisma.GiftVoucherWhereInput = {
    AND: [
      statusWhere,
      q.kind ? { kind: q.kind } : {},
      // A branch sees the vouchers it issued and the ones used at it.
      q.branchId == null ? {} : { OR: [{ issueBranchId: q.branchId }, { redeemedBranchId: q.branchId }] },
      search ? {
        OR: [
          { voucherNo: { contains: search, mode: "insensitive" } },
          { code: normalizeCode(search) },
          { issuedTo: { contains: search, mode: "insensitive" } },
          { issuedPhone: { contains: search } },
          { redeemedBillNo: { contains: search, mode: "insensitive" } },
        ],
      } : {},
    ],
  };
  const [total, rows, all] = await Promise.all([
    prisma.giftVoucher.count({ where }),
    prisma.giftVoucher.findMany({ where, orderBy: { id: "desc" }, skip: (q.page - 1) * q.limit, take: q.limit }),
    prisma.giftVoucher.findMany({
      where: q.branchId == null ? {} : { OR: [{ issueBranchId: q.branchId }, { redeemedBranchId: q.branchId }] },
      select: { kind: true, status: true, amount: true, expiresAt: true },
    }),
  ]);
  const sum = (list: typeof all) => ({ count: list.length, value: round2(list.reduce((s, row) => s + row.amount, 0)) });
  const active = all.filter((row) => row.status === "ACTIVE" && !isExpired(row, now));
  return {
    vouchers: await present(rows),
    total,
    page: q.page,
    limit: q.limit,
    summary: {
      /** SOLD and not used yet: money the shop owes. */
      owed: sum(active.filter((row) => row.kind === "SOLD")),
      /** FREE and not used yet: promotions still out there. */
      freeOut: sum(active.filter((row) => row.kind === "FREE")),
      redeemed: sum(all.filter((row) => row.status === "REDEEMED")),
      expired: sum(all.filter((row) => isExpired(row, now))),
      cancelled: sum(all.filter((row) => row.status === "CANCELLED")),
    },
  };
}

// ── For the Day End and the period reports ───────────────────────────────────
/** Vouchers issued and used during one shift. */
export async function shiftVouchers(shiftId: number) {
  const [issued, used] = await Promise.all([
    prisma.giftVoucher.findMany({ where: { issueShiftId: shiftId }, orderBy: { issuedAt: "asc" } }),
    prisma.giftVoucher.findMany({ where: { redeemedShiftId: shiftId }, orderBy: { redeemedAt: "asc" } }),
  ]);
  const sold = issued.filter((row) => row.kind === "SOLD");
  const by = (method: string) => round2(sold.filter((row) => row.paymentMethod === method).reduce((s, row) => s + row.amount, 0));
  return {
    issued: await present(issued),
    used: await present(used),
    soldCount: sold.length,
    soldTotal: round2(sold.reduce((s, row) => s + row.amount, 0)),
    soldCash: by("CASH"),
    soldCard: by("CARD"),
    soldTransfer: by("BANK_TRANSFER"),
    freeCount: issued.length - sold.length,
    freeTotal: round2(issued.filter((row) => row.kind === "FREE").reduce((s, row) => s + row.amount, 0)),
    usedTotal: round2(used.reduce((s, row) => s + row.amount, 0)),
    usedFree: round2(used.filter((row) => row.kind === "FREE").reduce((s, row) => s + row.amount, 0)),
  };
}

/** Everything about gift vouchers between two dates (issued, used, where) and what's still out now. */
export async function periodVouchers(from: Date, to: Date, branchId: number | null) {
  const inBranch = (field: "issueBranchId" | "redeemedBranchId") => (branchId == null ? {} : { [field]: branchId });
  const now = new Date();
  const [issued, used, open, expiredInPeriod, cancelled, branches] = await Promise.all([
    prisma.giftVoucher.findMany({ where: { issuedAt: { gte: from, lte: to }, ...inBranch("issueBranchId") } }),
    prisma.giftVoucher.findMany({ where: { status: "REDEEMED", redeemedAt: { gte: from, lte: to }, ...inBranch("redeemedBranchId") } }),
    prisma.giftVoucher.findMany({ where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gte: now } }], ...inBranch("issueBranchId") }, select: { kind: true, amount: true } }),
    prisma.giftVoucher.findMany({ where: { status: "ACTIVE", expiresAt: { gte: from, lte: to < now ? to : now }, ...inBranch("issueBranchId") }, select: { kind: true, amount: true } }),
    prisma.giftVoucher.findMany({ where: { status: "CANCELLED", cancelledAt: { gte: from, lte: to }, ...inBranch("issueBranchId") }, select: { kind: true, amount: true } }),
    branchNames(),
  ]);
  const total = (rows: Array<{ amount: number }>) => round2(rows.reduce((s, row) => s + row.amount, 0));
  const soldIssued = issued.filter((row) => row.kind === "SOLD");
  const byBranch = new Map<number, { branch: string; issuedCount: number; issuedValue: number; usedCount: number; usedValue: number; usedFromOtherBranches: number }>();
  const entry = (id: number | null) => {
    const key = id ?? 0;
    if (!byBranch.has(key)) byBranch.set(key, { branch: branches.get(key)?.name ?? "—", issuedCount: 0, issuedValue: 0, usedCount: 0, usedValue: 0, usedFromOtherBranches: 0 });
    return byBranch.get(key)!;
  };
  for (const row of issued) { const e = entry(row.issueBranchId); e.issuedCount += 1; e.issuedValue = round2(e.issuedValue + row.amount); }
  for (const row of used) {
    const e = entry(row.redeemedBranchId); e.usedCount += 1; e.usedValue = round2(e.usedValue + row.amount);
    if (row.issueBranchId !== row.redeemedBranchId) e.usedFromOtherBranches += 1;
  }
  return {
    issued: {
      soldCount: soldIssued.length,
      soldValue: total(soldIssued),
      soldCash: total(soldIssued.filter((row) => row.paymentMethod === "CASH")),
      soldCard: total(soldIssued.filter((row) => row.paymentMethod === "CARD")),
      soldTransfer: total(soldIssued.filter((row) => row.paymentMethod === "BANK_TRANSFER")),
      freeCount: issued.length - soldIssued.length,
      freeValue: total(issued.filter((row) => row.kind === "FREE")),
    },
    used: {
      count: used.length,
      value: total(used),
      soldValue: total(used.filter((row) => row.kind === "SOLD")),
      /** Free vouchers used: the promotion cost in the profit & loss. */
      freeValue: total(used.filter((row) => row.kind === "FREE")),
      atOtherBranch: used.filter((row) => row.issueBranchId !== row.redeemedBranchId).length,
    },
    expired: { count: expiredInPeriod.length, value: total(expiredInPeriod) },
    cancelled: { count: cancelled.length, value: total(cancelled) },
    outstandingNow: {
      owedCount: open.filter((row) => row.kind === "SOLD").length,
      owedValue: total(open.filter((row) => row.kind === "SOLD")),
      freeCount: open.filter((row) => row.kind === "FREE").length,
      freeValue: total(open.filter((row) => row.kind === "FREE")),
    },
    byBranch: [...byBranch.values()].sort((a, b) => b.usedValue + b.issuedValue - (a.usedValue + a.issuedValue)),
    usedList: (await present(used)).map((row) => ({ voucherNo: row.voucherNo, amount: row.amount, kind: row.kind, issueBranch: row.issueBranch, redeemedBranch: row.redeemedBranch, redeemedAt: row.redeemedAt, billNo: row.redeemedBillNo })),
  };
}

export { money as voucherMoney };
