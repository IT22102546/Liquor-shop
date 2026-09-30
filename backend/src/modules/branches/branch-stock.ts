import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";

type Db = Prisma.TransactionClient | typeof prisma;
export type StockDelta = { quantity?: number; damaged?: number; empties?: number };
export type BranchCounts = { quantity: number; damaged: number; empties: number };

/**
 * The one way stock changes: a branch's shelf / damaged / empties counts move, and the product's
 * company-wide totals move with them in the same transaction. Taking more than a branch has fails
 * (another till may have sold the bottles a moment ago).
 */
export async function changeStock(db: Db, branchId: number, productId: number, delta: StockDelta, what = "bottles", options: { allowShortShelf?: boolean } = {}) {
  const quantity = delta.quantity ?? 0;
  const damaged = delta.damaged ?? 0;
  const empties = delta.empties ?? 0;
  if (!quantity && !damaged && !empties) return;
  await db.branchStock.upsert({ where: { branchId_productId: { branchId, productId } }, create: { branchId, productId }, update: {} });
  const updated = await db.branchStock.updateMany({
    where: {
      branchId,
      productId,
      // A sale made offline already happened: the shelf may go below zero, showing the count was wrong.
      ...(quantity < 0 && !options.allowShortShelf ? { quantity: { gte: -quantity } } : {}),
      ...(damaged < 0 ? { damagedQuantity: { gte: -damaged } } : {}),
      ...(empties < 0 ? { emptyBottlesOnHand: { gte: -empties } } : {}),
    },
    data: {
      ...(quantity ? { quantity: { increment: quantity } } : {}),
      ...(damaged ? { damagedQuantity: { increment: damaged } } : {}),
      ...(empties ? { emptyBottlesOnHand: { increment: empties } } : {}),
    },
  });
  if (updated.count === 0) {
    const [row, product, branch] = await Promise.all([
      db.branchStock.findUnique({ where: { branchId_productId: { branchId, productId } } }),
      db.inventoryProduct.findUnique({ where: { id: productId }, select: { name: true } }),
      db.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
    ]);
    const name = product?.name ?? "this product";
    const at = branch ? ` at ${branch.name}` : "";
    if (quantity < 0) throw AppError.validation({ quantity: [`Only ${row?.quantity ?? 0} ${name} in stock${at}`] });
    if (damaged < 0) throw AppError.validation({ quantity: [`Only ${row?.damagedQuantity ?? 0} damaged ${name} kept aside${at}`] });
    throw AppError.validation({ quantity: [`Only ${row?.emptyBottlesOnHand ?? 0} empty ${name} ${what} on hand${at}`] });
  }
  await db.inventoryProduct.update({
    where: { id: productId },
    data: {
      ...(quantity ? { quantity: { increment: quantity } } : {}),
      ...(damaged ? { damagedQuantity: { increment: damaged } } : {}),
      ...(empties ? { emptyBottlesOnHand: { increment: empties } } : {}),
    },
  });
}

/** One branch's counts for many products (missing rows = nothing there). */
export async function branchCounts(branchId: number, productIds?: number[], db: Db = prisma) {
  const rows = await db.branchStock.findMany({
    where: { branchId, ...(productIds ? { productId: { in: productIds } } : {}) },
    select: { productId: true, quantity: true, damagedQuantity: true, emptyBottlesOnHand: true },
  });
  return new Map<number, BranchCounts>(rows.map((row) => [row.productId, { quantity: row.quantity, damaged: row.damagedQuantity, empties: row.emptyBottlesOnHand }]));
}

export async function countsAt(branchId: number, productId: number, db: Db = prisma): Promise<BranchCounts> {
  return (await branchCounts(branchId, [productId], db)).get(productId) ?? { quantity: 0, damaged: 0, empties: 0 };
}

/**
 * Shows products as one branch sees them: quantity / damaged / empties become that branch's counts,
 * and the company totals stay available as totalQuantity etc.
 */
export async function forBranch<T extends { id: number; quantity: number; damagedQuantity: number; emptyBottlesOnHand: number }>(branchId: number, products: T[]) {
  const counts = await branchCounts(branchId, products.map((product) => product.id));
  return products.map((product) => {
    const here = counts.get(product.id) ?? { quantity: 0, damaged: 0, empties: 0 };
    return {
      ...product,
      quantity: here.quantity,
      damagedQuantity: here.damaged,
      emptyBottlesOnHand: here.empties,
      totalQuantity: product.quantity,
      totalDamaged: product.damagedQuantity,
      totalEmpties: product.emptyBottlesOnHand,
    };
  });
}
