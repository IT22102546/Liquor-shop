import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";

type Db = Prisma.TransactionClient | typeof prisma;

/** STOCK = bottles for sale, EMPTIES = empty bottles on hand, DAMAGED = damaged bottles kept aside. */
export type MovementKind = "STOCK" | "EMPTIES" | "DAMAGED";
/**
 * STOCK: OPENING | RECEIVED | SOLD | ADJUSTED | CUSTOMER_RETURN (+, unopened bottles brought back) |
 *        EXCHANGED (−, new bottle given for a damaged one) | DAMAGED (−, found damaged in store) | RESTORED (+, back from damaged) |
 *        TRANSFER_OUT (−, sent to another branch on a GTN) | TRANSFER_IN (+, received from another branch)
 * EMPTIES: COLLECTED | RETURNED | ADJUSTED · DAMAGED: IN (+) | CLEARED (−)
 */
export type MovementType =
  | "OPENING" | "RECEIVED" | "SOLD" | "ADJUSTED" | "COLLECTED" | "RETURNED"
  | "CUSTOMER_RETURN" | "EXCHANGED" | "DAMAGED" | "RESTORED" | "IN" | "CLEARED"
  | "TRANSFER_OUT" | "TRANSFER_IN";

/** The branch's till session that is open right now, if any (one per branch). */
export async function findOpenShift(db: Db, branchId: number) {
  return db.posShift.findFirst({ where: { status: "OPEN", branchId }, orderBy: { openedAt: "desc" } });
}

/**
 * Records stock / empties changes for the stock day book, in a branch. Movements are linked to the
 * branch's open shift, so each shift's Z report can show opening → received → sold → closing per product.
 */
export async function recordMovements(
  db: Db,
  movements: Array<{ productId: number; kind: MovementKind; type: MovementType; quantity: number; reference?: string | null; createdById?: number | null }>,
  place: { branchId: number; shiftId?: number | null },
) {
  const rows = movements.filter((movement) => movement.quantity !== 0);
  if (rows.length === 0) return;
  const shift = place.shiftId === undefined ? (await findOpenShift(db, place.branchId))?.id ?? null : place.shiftId;
  await db.inventoryMovement.createMany({
    data: rows.map((movement) => ({ ...movement, reference: movement.reference ?? null, createdById: movement.createdById ?? null, shiftId: shift, branchId: place.branchId })),
  });
}
