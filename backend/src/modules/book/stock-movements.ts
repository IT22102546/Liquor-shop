import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";

type Db = Prisma.TransactionClient | typeof prisma;

/** STOCK = bottles for sale, EMPTIES = empty bottles on hand, DAMAGED = damaged bottles kept aside. */
export type MovementKind = "STOCK" | "EMPTIES" | "DAMAGED";
/**
 * STOCK: OPENING | RECEIVED | SOLD | ADJUSTED | CUSTOMER_RETURN (+, unopened bottles brought back) |
 *        EXCHANGED (−, new bottle given for a damaged one) | DAMAGED (−, found damaged in store) | RESTORED (+, back from damaged)
 * EMPTIES: COLLECTED | RETURNED | ADJUSTED · DAMAGED: IN (+) | CLEARED (−)
 */
export type MovementType =
  | "OPENING" | "RECEIVED" | "SOLD" | "ADJUSTED" | "COLLECTED" | "RETURNED"
  | "CUSTOMER_RETURN" | "EXCHANGED" | "DAMAGED" | "RESTORED" | "IN" | "CLEARED";

/** The till session that is open right now, if any (only one can be open at a time). */
export async function findOpenShift(db: Db = prisma) {
  return db.posShift.findFirst({ where: { status: "OPEN" }, orderBy: { openedAt: "desc" } });
}

/**
 * Records stock / empties changes for the stock day book. Movements are linked to the open shift,
 * so each shift's Z report can show opening → received → sold → closing per product.
 */
export async function recordMovements(
  db: Db,
  movements: Array<{ productId: number; kind: MovementKind; type: MovementType; quantity: number; reference?: string | null; createdById?: number | null }>,
  shiftId?: number | null,
) {
  const rows = movements.filter((movement) => movement.quantity !== 0);
  if (rows.length === 0) return;
  const shift = shiftId === undefined ? (await findOpenShift(db))?.id ?? null : shiftId;
  await db.inventoryMovement.createMany({
    data: rows.map((movement) => ({ ...movement, reference: movement.reference ?? null, createdById: movement.createdById ?? null, shiftId: shift })),
  });
}
