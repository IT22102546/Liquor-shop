/**
 * Loyalty points earned on an amount paid (after empties, discounts and points used).
 * The rate comes from Shop Settings: 1 point for every `rupeesPerPoint` rupees.
 */
export function loyaltyPointsFor(amountPaid: number, rupeesPerPoint: number) {
  if (!(amountPaid > 0) || !(rupeesPerPoint > 0)) return 0;
  return Math.floor(amountPaid / rupeesPerPoint);
}
