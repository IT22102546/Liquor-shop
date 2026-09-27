import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./cash-book.service";
import { getSettings } from "../settings/settings.service";

/**
 * Daily / weekly / monthly / yearly report for any date range, built from every counter sale,
 * the cash book, closed shifts and stock movements in that range.
 */

const round2 = (value: number) => Math.round(value * 100) / 100;
type Bucketing = "HOUR" | "DAY" | "MONTH";
type PayKind = "cash" | "card" | "transfer";
const kindOf = (method: string): PayKind => (method === "CASH" ? "cash" : method === "CARD" ? "card" : "transfer");
/** Paid out but not a running cost: stock is already counted as cost of goods sold; an advance is a loan. */
const NOT_OPERATING = new Set(["STOCK_PURCHASE", "STAFF_ADVANCE"]);

const pad = (value: number) => String(value).padStart(2, "0");
function bucketKey(date: Date, mode: Bucketing) {
  if (mode === "HOUR") return `${pad(date.getHours())}:00`;
  if (mode === "DAY") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}
function bucketKeys(from: Date, to: Date, mode: Bucketing) {
  if (mode === "HOUR") return Array.from({ length: 24 }, (_, hour) => `${pad(hour)}:00`);
  const keys: string[] = [];
  const cursor = new Date(from);
  if (mode === "MONTH") cursor.setDate(1);
  while (cursor <= to && keys.length < 400) {
    keys.push(bucketKey(cursor, mode));
    if (mode === "DAY") cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

export async function getPeriodReport(fromText: string, toText: string) {
  const from = new Date(`${fromText}T00:00:00`);
  const to = new Date(`${toText}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw AppError.validation({ from: ["Choose a valid date range"] });
  const days = Math.round((to.getTime() - from.getTime() + 1) / 86_400_000);
  if (days > 1_100) throw AppError.validation({ to: ["Choose a range of up to 3 years"] });
  const mode: Bucketing = days <= 1 ? "HOUR" : days <= 62 ? "DAY" : "MONTH";

  const [sales, entries, shifts, movements, products, newMembers, owed, settings] = await Promise.all([
    prisma.posCounterSale.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "asc" },
      select: {
        invoiceGroupCode: true, totalAmount: true, paymentMethod: true, createdAt: true, customerId: true,
        emptyDeduction: true, emptiesReturned: true, discountAmount: true, discountType: true, discountValue: true, pointsValue: true, pointsRedeemed: true, pointsEarned: true,
        cashier: { select: { name: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.posCashEntry.findMany({ where: { entryDate: { gte: from, lte: to }, voided: false } }),
    prisma.posShift.findMany({ where: { status: "CLOSED", closedAt: { gte: from, lte: to } }, orderBy: { closedAt: "asc" } }),
    prisma.inventoryMovement.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { productId: true, kind: true, type: true, quantity: true } }),
    prisma.inventoryProduct.findMany({
      select: {
        id: true, name: true, compatibleWith: true, quantity: true, purchasePrice: true, taxPaid: true, additionalExpenses: true,
        brand: { select: { name: true } }, category: { select: { name: true } },
      },
    }),
    prisma.posCustomer.count({ where: { createdAt: { gte: from, lte: to }, mobileNumber: { not: "WALK-IN" } } }),
    // Points members hold right now: what the shop still owes in future discounts.
    prisma.posCustomer.aggregate({ where: { mobileNumber: { not: "WALK-IN" }, loyaltyPoints: { gt: 0 } }, _sum: { loyaltyPoints: true }, _count: true }),
    getSettings(),
  ]);
  const lines = sales.length
    ? await prisma.posCustomerPurchase.findMany({
        where: { invoiceGroupCode: { in: sales.map((sale) => sale.invoiceGroupCode) } },
        select: { invoiceGroupCode: true, quantity: true, finalSellingPrice: true, inventoryProductId: true },
      })
    : [];

  const productById = new Map(products.map((product) => [product.id, product]));
  const unitCost = (id: number | null) => {
    const product = id != null ? productById.get(id) : undefined;
    return product ? (product.purchasePrice ?? 0) + (product.taxPaid ?? 0) + (product.additionalExpenses ?? 0) : 0;
  };
  const saleByCode = new Map(sales.map((sale) => [sale.invoiceGroupCode, sale]));

  // ── Buckets (hours of the day, days, or months) ──
  const keys = bucketKeys(from, to, mode);
  const blank = () => ({ bills: 0, netSales: 0, cash: 0, card: 0, transfer: 0, cost: 0, expenses: 0 });
  const buckets = new Map(keys.map((key) => [key, blank()]));
  const bucketOf = (date: Date) => {
    const key = bucketKey(date, mode);
    if (!buckets.has(key)) buckets.set(key, blank());
    return buckets.get(key)!;
  };

  // ── Sales ──
  const pay = { cash: 0, card: 0, transfer: 0 };
  const payCount = { cash: 0, card: 0, transfer: 0 };
  const staff = new Map<string, { name: string; bills: number; cash: number; card: number; transfer: number; total: number }>();
  sales.forEach((sale) => {
    const kind = kindOf(sale.paymentMethod);
    pay[kind] += sale.totalAmount;
    payCount[kind] += 1;
    const bucket = bucketOf(sale.createdAt);
    bucket.bills += 1;
    bucket.netSales += sale.totalAmount;
    bucket[kind] += sale.totalAmount;
    const row = staff.get(sale.cashier.name) ?? { name: sale.cashier.name, bills: 0, cash: 0, card: 0, transfer: 0, total: 0 };
    row.bills += 1;
    row.total += sale.totalAmount;
    row[kind] += sale.totalAmount;
    staff.set(sale.cashier.name, row);
  });

  let cost = 0;
  let units = 0;
  const byProduct = new Map<number, { name: string; detail: string; category: string; units: number; amount: number; cost: number }>();
  const byCategory = new Map<string, { name: string; units: number; amount: number; cost: number }>();
  lines.forEach((line) => {
    const lineCost = unitCost(line.inventoryProductId) * line.quantity;
    cost += lineCost;
    units += line.quantity;
    const sale = line.invoiceGroupCode ? saleByCode.get(line.invoiceGroupCode) : undefined;
    if (sale) bucketOf(sale.createdAt).cost += lineCost;
    const product = line.inventoryProductId != null ? productById.get(line.inventoryProductId) : undefined;
    const id = line.inventoryProductId ?? -1;
    const entry = byProduct.get(id) ?? {
      name: product?.name ?? "Deleted product",
      detail: [product?.brand.name, product?.compatibleWith].filter(Boolean).join(" · "),
      category: product?.category.name ?? "—",
      units: 0, amount: 0, cost: 0,
    };
    entry.units += line.quantity;
    entry.amount += line.finalSellingPrice;
    entry.cost += lineCost;
    byProduct.set(id, entry);
    const categoryName = product?.category.name ?? "Other";
    const category = byCategory.get(categoryName) ?? { name: categoryName, units: 0, amount: 0, cost: 0 };
    category.units += line.quantity;
    category.amount += line.finalSellingPrice;
    category.cost += lineCost;
    byCategory.set(categoryName, category);
  });

  const netSales = round2(pay.cash + pay.card + pay.transfer);
  const emptyDeduction = round2(sales.reduce((sum, sale) => sum + sale.emptyDeduction, 0));
  const discounts = round2(sales.reduce((sum, sale) => sum + sale.discountAmount, 0));
  const pointsValue = round2(sales.reduce((sum, sale) => sum + sale.pointsValue, 0));
  const grossProfit = round2(netSales - cost);

  // ── Cash book ──
  const expenseRows = entries.filter((entry) => entry.direction === "OUT");
  const expensesByCategory = new Map<string, { category: string; label: string; amount: number; count: number; operating: boolean }>();
  expenseRows.forEach((entry) => {
    const row = expensesByCategory.get(entry.category) ?? { category: entry.category, label: EXPENSE_CATEGORIES[entry.category] ?? entry.category, amount: 0, count: 0, operating: !NOT_OPERATING.has(entry.category) };
    row.amount += entry.amount;
    row.count += 1;
    expensesByCategory.set(entry.category, row);
    if (row.operating) bucketOf(entry.entryDate).expenses += entry.amount;
  });
  const expensesAll = round2(expenseRows.reduce((sum, entry) => sum + entry.amount, 0));
  const operatingExpenses = round2([...expensesByCategory.values()].filter((row) => row.operating).reduce((sum, row) => sum + row.amount, 0));
  const otherIncomeRows = entries.filter((entry) => entry.direction === "IN" && !entry.automatic);
  const otherIncome = new Map<string, { category: string; label: string; amount: number; count: number }>();
  otherIncomeRows.forEach((entry) => {
    const row = otherIncome.get(entry.category) ?? { category: entry.category, label: INCOME_CATEGORIES[entry.category] ?? entry.category, amount: 0, count: 0 };
    row.amount += entry.amount;
    row.count += 1;
    otherIncome.set(entry.category, row);
  });
  const takings = entries.filter((entry) => entry.direction === "IN" && entry.automatic);
  const banked = round2(takings.filter((entry) => entry.bankStatus === "BANKED").reduce((sum, entry) => sum + entry.amount, 0));
  const waiting = round2(takings.filter((entry) => entry.bankStatus === "PENDING").reduce((sum, entry) => sum + entry.amount, 0));

  // ── Shifts ──
  const staffIds = [...new Set(shifts.flatMap((shift) => [shift.openedById, shift.closedById]).filter((id): id is number => Boolean(id)))];
  const staffNames = new Map((await prisma.posAdmin.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })).map((member) => [member.id, member.name]));
  const shiftRows = shifts.map((shift) => {
    const report = (shift.report ?? {}) as { sales?: { netSales?: number; bills?: number }; close?: { cardDifference?: number | null } };
    return {
      shiftNo: shift.shiftNo,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openedBy: staffNames.get(shift.openedById) ?? "—",
      closedBy: shift.closedById ? staffNames.get(shift.closedById) ?? "—" : "—",
      bills: report.sales?.bills ?? 0,
      netSales: report.sales?.netSales ?? 0,
      cashDifference: shift.cashDifference ?? 0,
      differenceReason: shift.differenceReason,
      cardDifference: report.close?.cardDifference ?? null,
      cashBanked: shift.cashBanked ?? 0,
    };
  });
  const over = round2(shiftRows.filter((row) => row.cashDifference > 0.004).reduce((sum, row) => sum + row.cashDifference, 0));
  const short = round2(shiftRows.filter((row) => row.cashDifference < -0.004).reduce((sum, row) => sum + row.cashDifference, 0));

  // ── Stock movements ──
  const stock = new Map<number, { received: number; sold: number; adjusted: number; collected: number; returned: number }>();
  movements.forEach((movement) => {
    const row = stock.get(movement.productId) ?? { received: 0, sold: 0, adjusted: 0, collected: 0, returned: 0 };
    if (movement.kind === "STOCK") {
      if (movement.type === "RECEIVED" || movement.type === "OPENING") row.received += movement.quantity;
      else if (movement.type === "SOLD") row.sold += -movement.quantity;
      else row.adjusted += movement.quantity;
    } else if (movement.type === "COLLECTED") row.collected += movement.quantity;
    else if (movement.type === "RETURNED") row.returned += -movement.quantity;
    stock.set(movement.productId, row);
  });
  const stockRows = [...stock.entries()].map(([productId, row]) => {
    const product = productById.get(productId);
    return {
      name: product?.name ?? "Deleted product",
      detail: [product?.brand.name, product?.compatibleWith].filter(Boolean).join(" · "),
      ...row,
      receivedValue: round2(row.received * unitCost(productId)),
      onHand: product?.quantity ?? 0,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const stockValueNow = round2(products.reduce((sum, product) => sum + Math.max(product.quantity, 0) * unitCost(product.id), 0));

  return {
    period: { from: fromText, to: toText, days, grouping: mode },
    sales: {
      bills: sales.length,
      units,
      grossSales: round2(netSales + emptyDeduction + discounts + pointsValue),
      emptyDeduction,
      emptiesReturned: sales.reduce((sum, sale) => sum + sale.emptiesReturned, 0),
      discounts,
      pointsValue,
      netSales,
      averageBill: sales.length ? round2(netSales / sales.length) : 0,
      cash: round2(pay.cash), card: round2(pay.card), transfer: round2(pay.transfer),
      cashBills: payCount.cash, cardBills: payCount.card, transferBills: payCount.transfer,
      memberBills: sales.filter((sale) => sale.customerId != null).length,
    },
    profit: {
      costOfSales: round2(cost),
      grossProfit,
      margin: netSales > 0 ? round2((grossProfit / netSales) * 100) : 0,
      operatingExpenses,
      netProfit: round2(grossProfit - operatingExpenses + [...otherIncome.values()].filter((row) => row.category !== "OWNER_CASH_IN").reduce((sum, row) => sum + row.amount, 0)),
    },
    trend: [...buckets.entries()].map(([key, row]) => ({
      key, bills: row.bills, netSales: round2(row.netSales), cash: round2(row.cash), card: round2(row.card), transfer: round2(row.transfer),
      grossProfit: round2(row.netSales - row.cost), expenses: round2(row.expenses),
    })),
    byStaff: [...staff.values()].map((row) => ({ ...row, cash: round2(row.cash), card: round2(row.card), transfer: round2(row.transfer), total: round2(row.total) })).sort((a, b) => b.total - a.total),
    byProduct: [...byProduct.values()].map((row) => ({ ...row, amount: round2(row.amount), cost: round2(row.cost), profit: round2(row.amount - row.cost) })).sort((a, b) => b.amount - a.amount),
    byCategory: [...byCategory.values()].map((row) => ({ ...row, amount: round2(row.amount), cost: round2(row.cost), profit: round2(row.amount - row.cost) })).sort((a, b) => b.amount - a.amount),
    cashBook: {
      expensesAll,
      expenses: [...expensesByCategory.values()].map((row) => ({ ...row, amount: round2(row.amount) })).sort((a, b) => b.amount - a.amount),
      otherIncome: [...otherIncome.values()].map((row) => ({ ...row, amount: round2(row.amount) })).sort((a, b) => b.amount - a.amount),
      banked,
      waiting,
    },
    shifts: {
      count: shiftRows.length,
      over,
      short,
      net: round2(over + short),
      withDifference: shiftRows.filter((row) => Math.abs(row.cashDifference) > 0.004).length,
      rows: shiftRows,
    },
    stock: { rows: stockRows, stockValueNow },
    discounts: discountSummary(sales),
    loyalty: {
      newMembers,
      memberBills: sales.filter((sale) => sale.customerId != null).length,
      pointsEarned: sales.reduce((sum, sale) => sum + sale.pointsEarned, 0),
      pointsRedeemed: sales.reduce((sum, sale) => sum + sale.pointsRedeemed, 0),
      pointsValue: round2(sales.reduce((sum, sale) => sum + sale.pointsValue, 0)),
      redeemBills: sales.filter((sale) => sale.pointsRedeemed > 0).length,
      byMember: memberSummary(sales),
      owed: { points: owed._sum.loyaltyPoints ?? 0, members: owed._count, value: round2((owed._sum.loyaltyPoints ?? 0) * settings.loyaltyPointValue), pointValue: settings.loyaltyPointValue },
    },
    // Every bill with a discount or points spent, with who served it.
    adjustments: sales
      .filter((sale) => sale.discountAmount > 0 || sale.pointsRedeemed > 0)
      .map((sale) => ({
        billNo: sale.invoiceGroupCode,
        time: sale.createdAt,
        cashier: sale.cashier.name,
        member: memberLabel(sale.customer),
        billBefore: round2(sale.totalAmount + sale.discountAmount + sale.pointsValue),
        discountType: sale.discountType,
        discountValue: sale.discountValue,
        discountAmount: sale.discountAmount,
        pointsRedeemed: sale.pointsRedeemed,
        pointsValue: sale.pointsValue,
        total: sale.totalAmount,
      })),
    generatedAt: new Date(),
  };
}

type SaleRow = {
  totalAmount: number; discountAmount: number; discountType: string | null; pointsValue: number; pointsRedeemed: number; pointsEarned: number;
  cashier: { name: string }; customer: { id: number; firstName: string | null; lastName: string | null } | null;
};
const memberLabel = (customer: SaleRow["customer"]) => (customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Member" : null);

function discountSummary(sales: SaleRow[]) {
  const given = sales.filter((sale) => sale.discountAmount > 0);
  const byStaff = new Map<string, { name: string; bills: number; amount: number }>();
  given.forEach((sale) => {
    const row = byStaff.get(sale.cashier.name) ?? { name: sale.cashier.name, bills: 0, amount: 0 };
    row.bills += 1;
    row.amount = round2(row.amount + sale.discountAmount);
    byStaff.set(sale.cashier.name, row);
  });
  const byType = (type: string) => {
    const rows = given.filter((sale) => sale.discountType === type);
    return { bills: rows.length, amount: round2(rows.reduce((sum, sale) => sum + sale.discountAmount, 0)) };
  };
  return {
    bills: given.length,
    amount: round2(given.reduce((sum, sale) => sum + sale.discountAmount, 0)),
    percent: byType("PERCENT"),
    fixed: byType("AMOUNT"),
    byStaff: [...byStaff.values()].sort((a, b) => b.amount - a.amount),
  };
}

function memberSummary(sales: SaleRow[]) {
  const members = new Map<number, { name: string; bills: number; spent: number; earned: number; redeemed: number; value: number }>();
  sales.forEach((sale) => {
    if (!sale.customer) return;
    const row = members.get(sale.customer.id) ?? { name: memberLabel(sale.customer) ?? "Member", bills: 0, spent: 0, earned: 0, redeemed: 0, value: 0 };
    row.bills += 1;
    row.spent = round2(row.spent + sale.totalAmount);
    row.earned += sale.pointsEarned;
    row.redeemed += sale.pointsRedeemed;
    row.value = round2(row.value + sale.pointsValue);
    members.set(sale.customer.id, row);
  });
  return [...members.values()].sort((a, b) => b.spent - a.spent);
}

export type PeriodReport = Awaited<ReturnType<typeof getPeriodReport>>;
