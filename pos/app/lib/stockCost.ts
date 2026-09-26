/** Cost-per-unit helpers for adding stock (mirrors the backend's restockProduct). */

const rupees = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const hasCostPrice = (product: { purchasePrice?: number | null }) => (product.purchasePrice ?? 0) > 0;

/**
 * Per-unit cost after adding stock. With no batch cost the new units are assumed to cost the current
 * per-unit price, so the average stays the same.
 */
export function blendedUnitCost(currentUnitCost: number | null | undefined, currentUnits: number, addedUnits: number, batchTotal?: number) {
  if (batchTotal === undefined || !Number.isFinite(batchTotal)) return currentUnitCost ?? 0;
  const units = Math.max(currentUnits, 0) + addedUnits;
  if (units <= 0) return currentUnitCost ?? 0;
  return Math.round((((currentUnitCost ?? 0) * Math.max(currentUnits, 0) + batchTotal) / units) * 100) / 100;
}

/** One-line explanation shown under the cost box while adding stock. */
export function stockCostHint(
  product: { purchasePrice?: number | null; quantity: number },
  qtyText: string,
  costText: string,
): { text: string; tone: "info" | "warn" } {
  const qty = Math.floor(Number(qtyText));
  const cost = costText.trim() === "" ? undefined : Number(costText);
  if (!hasCostPrice(product)) {
    if (cost === undefined) return { text: "Required — this product has no cost price yet", tone: "warn" };
    return qty > 0
      ? { text: `Cost will be ${rupees(blendedUnitCost(0, 0, qty, cost))} per unit`, tone: "info" }
      : { text: "Enter the quantity to see the cost per unit", tone: "info" };
  }
  const current = product.purchasePrice ?? 0;
  if (cost === undefined) return { text: `Optional — leave empty to keep ${rupees(current)} per unit`, tone: "info" };
  if (!(qty > 0)) return { text: "Enter the quantity to see the new cost per unit", tone: "info" };
  const next = blendedUnitCost(current, product.quantity, qty, cost);
  return { text: `New average cost ${rupees(next)} per unit (was ${rupees(current)}; this batch ${rupees(cost / qty)} each)`, tone: "info" };
}
