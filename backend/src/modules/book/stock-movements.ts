import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";

type Db = Prisma.TransactionClient | typeof prisma;

export type MovementKind = "STOCK" | "EMPTIES";
export type MovementType = "OPENING" | "RECEIVED" | "SOLD" | "ADJUSTED" | "COLLECTED" | "RETURNED";

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
