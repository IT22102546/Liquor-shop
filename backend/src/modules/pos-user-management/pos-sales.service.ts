import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import type { DashboardQueryDto, SalesQueryDto } from "./dto/pos-user.dto";

const round2 = (value: number) => Math.round(value * 100) / 100;
const startOfDay = (date: string) => new Date(`${date}T00:00:00`);
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999`);
const fullName = (person?: { firstName: string; lastName: string } | null) =>
  person ? [person.firstName, person.lastName].filter(Boolean).join(" ") : null;

const lineInclude = {
  inventoryProduct: {
    select: {
      id: true,
      name: true,
      compatibleWith: true,
      emptyBottlePrice: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
    },
  },
} satisfies Prisma.PosCustomerPurchaseInclude;

// ── Sales bills ──────────────────────────────────────────────────────────────

/** Counter sales (bills) with their items, cashier and loyalty member, newest first. */
export async function listSales(query: SalesQueryDto) {
  const search = query.search?.trim();
  const where: Prisma.PosCounterSaleWhereInput = {
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.from || query.to
      ? { createdAt: { ...(query.from ? { gte: startOfDay(query.from) } : {}), ...(query.to ? { lte: endOfDay(query.to) } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { invoiceGroupCode: { contains: search, mode: "insensitive" } },
            { cashier: { name: { contains: search, mode: "insensitive" } } },
            { customer: { firstName: { contains: search, mode: "insensitive" } } },
            { customer: { lastName: { contains: search, mode: "insensitive" } } },
            { customer: { mobileNumber: { contains: search.replace(/\s+/g, "") } } },
          ],
        }
      : {}),
  };

  const [sales, total, totals] = await Promise.all([
    prisma.posCounterSale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        cashier: { select: { name: true, role: true } },
        customer: { select: { id: true, firstName: true, lastName: true, mobileNumber: true, loyaltyPoints: true } },
      },
    }),
    prisma.posCounterSale.count({ where }),
    prisma.posCounterSale.aggregate({ where, _sum: { totalAmount: true, emptiesReturned: true } }),
  ]);

  const lines = await prisma.posCustomerPurchase.findMany({
    where: { invoiceGroupCode: { in: sales.map((sale) => sale.invoiceGroupCode) } },
    include: lineInclude,
    orderBy: { id: "asc" },
  });
  const linesByBill = new Map<string, typeof lines>();
  lines.forEach((line) => {
    const key = line.invoiceGroupCode ?? "";
    linesByBill.set(key, [...(linesByBill.get(key) ?? []), line]);
  });

  return {
    sales: sales.map((sale) => {
      const items = (linesByBill.get(sale.invoiceGroupCode) ?? []).map((line) => ({
        productId: line.inventoryProductId,
        name: line.inventoryProduct?.name ?? line.customDescription ?? "Item",
        brand: line.inventoryProduct?.brand.name ?? null,
        size: line.inventoryProduct?.compatibleWith ?? null,
        category: line.inventoryProduct?.category.name ?? null,
        imageUrl: line.inventoryProduct?.images[0]?.url ?? null,
        quantity: line.quantity,
        unitPrice: line.currentSellingPrice ?? line.finalSellingPrice / Math.max(line.quantity, 1),
        emptiesReturned: line.emptiesReturned,
        emptyPrice: line.emptiesReturned > 0 ? round2(line.emptyDeduction / line.emptiesReturned) : 0,
        emptyDeduction: line.emptyDeduction,
        lineTotal: line.finalSellingPrice,
      }));
      return {
        id: sale.id,
        billNo: sale.invoiceGroupCode,
        soldAt: sale.createdAt,
        paymentMethod: sale.paymentMethod,
        subtotal: round2(sale.totalAmount + sale.emptyDeduction),
        emptyDeduction: sale.emptyDeduction,
        emptiesReturned: sale.emptiesReturned,
        total: sale.totalAmount,
        amountReceived: sale.amountReceived,
        changeGiven: sale.changeGiven,
        cashier: sale.cashier,
        customer: sale.customer
          ? { id: sale.customer.id, name: fullName(sale.customer), mobileNumber: sale.customer.mobileNumber, pointsBalance: sale.customer.loyaltyPoints }
          : null,
        pointsEarned: sale.pointsEarned,
        units: items.reduce((sum, item) => sum + item.quantity, 0),
        items,
      };
    }),
    summary: { bills: total, revenue: round2(totals._sum.totalAmount ?? 0), emptiesReturned: totals._sum.emptiesReturned ?? 0 },
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  };
}

// ── Dashboard ────────────────────────────────────────────────────────────────

type Bucketing = "HOUR" | "DAY" | "MONTH";

function bucketKey(date: Date, mode: Bucketing) {
  const pad = (value: number) => String(value).padStart(2, "0");
  if (mode === "HOUR") return `${pad(date.getHours())}:00`;
  if (mode === "DAY") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function bucketKeys(from: Date, to: Date, mode: Bucketing) {
  const keys: string[] = [];
  if (mode === "HOUR") {
    for (let hour = 0; hour < 24; hour += 1) keys.push(`${String(hour).padStart(2, "0")}:00`);
    return keys;
  }
  const cursor = new Date(from);
  if (mode === "MONTH") cursor.setDate(1);
  while (cursor <= to && keys.length < 400) {
    keys.push(bucketKey(cursor, mode));
    if (mode === "DAY") cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

async function periodFigures(from: Date, to: Date) {
  const [lines, bills] = await Promise.all([
    prisma.posCustomerPurchase.findMany({
      where: { purchasedAt: { gte: from, lte: to } },
      select: {
        invoiceGroupCode: true,
        id: true,
        quantity: true,
        finalSellingPrice: true,
        emptiesReturned: true,
        emptyDeduction: true,
        purchasedAt: true,
        inventoryProduct: {
          select: {
            id: true,
            name: true,
            compatibleWith: true,
            purchasePrice: true,
            taxPaid: true,
            additionalExpenses: true,
            category: { select: { name: true } },
            images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          },
        },
      },
    }),
    prisma.posCounterSale.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { totalAmount: true, paymentMethod: true, customerId: true, createdAt: true, cashier: { select: { id: true, name: true } } },
    }),
  ]);

  let revenue = 0;
  let cost = 0;
  let units = 0;
  let empties = 0;
  let emptyDeduction = 0;
  const billCodes = new Set<string>();
  lines.forEach((line) => {
    const product = line.inventoryProduct;
    const unitCost = (product?.purchasePrice ?? 0) + (product?.taxPaid ?? 0) + (product?.additionalExpenses ?? 0);
    revenue += line.finalSellingPrice;
    cost += unitCost * line.quantity;
    units += line.quantity;
    empties += line.emptiesReturned;
    emptyDeduction += line.emptyDeduction;
    billCodes.add(line.invoiceGroupCode ?? `line-${line.id}`);
  });
  const billCount = billCodes.size;
  return {
    lines,
    bills,
    figures: {
      revenue: round2(revenue),
      cost: round2(cost),
      grossProfit: round2(revenue - cost),
      margin: revenue > 0 ? round2(((revenue - cost) / revenue) * 100) : 0,
      bills: billCount,
      units,
      averageBill: billCount > 0 ? round2(revenue / billCount) : 0,
      emptiesReturned: empties,
      emptyDeduction: round2(emptyDeduction),
      memberBills: bills.filter((bill) => bill.customerId != null).length,
    },
  };
}

/**
 * Everything the dashboard shows for a date range, calculated on the server from all sales
 * (no row limits), plus the previous period of the same length for comparison.
 */
export async function getDashboardSummary(query: DashboardQueryDto) {
  const from = startOfDay(query.from);
  const to = endOfDay(query.to);
  const lengthMs = to.getTime() - from.getTime() + 1;
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(from.getTime() - lengthMs);
  const days = Math.round(lengthMs / 86_400_000);
  const mode: Bucketing = days <= 1 ? "HOUR" : days <= 62 ? "DAY" : "MONTH";

  const [current, previous, products, newMembers, members, recent] = await Promise.all([
    periodFigures(from, to),
    periodFigures(previousFrom, previousTo),
    prisma.inventoryProduct.findMany({
      select: {
        id: true, name: true, compatibleWith: true, quantity: true, lowStockThreshold: true, emptyBottlesOnHand: true,
        category: { select: { name: true } },
        images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
      },
    }),
    prisma.posCustomer.count({ where: { createdAt: { gte: from, lte: to }, mobileNumber: { not: "WALK-IN" } } }),
    prisma.posCustomer.count({ where: { mobileNumber: { not: "WALK-IN" } } }),
    prisma.posCounterSale.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        invoiceGroupCode: true, totalAmount: true, paymentMethod: true, emptiesReturned: true, createdAt: true,
        cashier: { select: { name: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  // Trend: current period vs the previous one, bucket by bucket.
  const keys = bucketKeys(from, to, mode);
  const previousKeys = bucketKeys(previousFrom, previousTo, mode);
  const sumBy = (lines: typeof current.lines, bucketList: string[]) => {
    const totals = new Map<string, { revenue: number; bills: Set<string> }>();
    lines.forEach((line) => {
      const key = bucketKey(line.purchasedAt, mode);
      const entry = totals.get(key) ?? { revenue: 0, bills: new Set<string>() };
      entry.revenue += line.finalSellingPrice;
      entry.bills.add(line.invoiceGroupCode ?? `line-${line.id}`);
      totals.set(key, entry);
    });
    return bucketList.map((key) => ({ revenue: round2(totals.get(key)?.revenue ?? 0), bills: totals.get(key)?.bills.size ?? 0 }));
  };
  const currentSeries = sumBy(current.lines, keys);
  const previousSeries = sumBy(previous.lines, previousKeys);
  const trend = keys.map((key, index) => ({
    key,
    revenue: currentSeries[index].revenue,
    bills: currentSeries[index].bills,
    previousRevenue: previousSeries[index]?.revenue ?? 0,
  }));

  // Top sellers and category mix.
  const byProduct = new Map<number, { id: number; name: string; size: string | null; category: string; imageUrl: string | null; units: number; revenue: number }>();
  const byCategory = new Map<string, number>();
  current.lines.forEach((line) => {
    const product = line.inventoryProduct;
    if (!product) return;
    const entry = byProduct.get(product.id) ?? {
      id: product.id, name: product.name, size: product.compatibleWith, category: product.category.name,
      imageUrl: product.images[0]?.url ?? null, units: 0, revenue: 0,
    };
    entry.units += line.quantity;
    entry.revenue = round2(entry.revenue + line.finalSellingPrice);
    byProduct.set(product.id, entry);
    byCategory.set(product.category.name, round2((byCategory.get(product.category.name) ?? 0) + line.finalSellingPrice));
  });

  // Staff: bills and revenue per cashier.
  const byStaff = new Map<number, { name: string; bills: number; revenue: number }>();
  current.bills.forEach((bill) => {
    const entry = byStaff.get(bill.cashier.id) ?? { name: bill.cashier.name, bills: 0, revenue: 0 };
    entry.bills += 1;
    entry.revenue = round2(entry.revenue + bill.totalAmount);
    byStaff.set(bill.cashier.id, entry);
  });

  const cashTotal = current.bills.filter((bill) => bill.paymentMethod === "CASH").reduce((sum, bill) => sum + bill.totalAmount, 0);
  const cardTotal = current.bills.filter((bill) => bill.paymentMethod !== "CASH").reduce((sum, bill) => sum + bill.totalAmount, 0);

  const stockWatch = products
    .filter((product) => product.quantity <= 0 || ((product.lowStockThreshold ?? 0) > 0 && product.quantity <= (product.lowStockThreshold ?? 0)))
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 8)
    .map((product) => ({
      id: product.id, name: product.name, size: product.compatibleWith, category: product.category.name,
      imageUrl: product.images[0]?.url ?? null, quantity: product.quantity, lowStockThreshold: product.lowStockThreshold ?? 0,
    }));

  return {
    range: { from: query.from, to: query.to, bucketing: mode },
    current: current.figures,
    previous: previous.figures,
    trend,
    topProducts: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    categoryMix: [...byCategory.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue),
    payments: { cash: round2(cashTotal), card: round2(cardTotal) },
    staff: [...byStaff.values()].sort((a, b) => b.revenue - a.revenue),
    members: { total: members, newInPeriod: newMembers },
    stock: {
      products: products.length,
      lowStock: products.filter((p) => p.quantity > 0 && (p.lowStockThreshold ?? 0) > 0 && p.quantity <= (p.lowStockThreshold ?? 0)).length,
      outOfStock: products.filter((p) => p.quantity <= 0).length,
      emptiesOnHand: products.reduce((sum, p) => sum + p.emptyBottlesOnHand, 0),
      watch: stockWatch,
    },
    recentBills: recent.map((bill) => ({
      billNo: bill.invoiceGroupCode,
      total: bill.totalAmount,
      paymentMethod: bill.paymentMethod,
      emptiesReturned: bill.emptiesReturned,
      soldAt: bill.createdAt,
      cashier: bill.cashier.name,
      customer: fullName(bill.customer),
    })),
  };
}
