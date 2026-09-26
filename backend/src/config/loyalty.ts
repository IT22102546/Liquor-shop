/** Loyalty programme: members earn 1 point for every Rs. 100 paid (after empty-bottle deductions). */
export const LOYALTY_RUPEES_PER_POINT = 100;

export function loyaltyPointsFor(amountPaid: number) {
  return amountPaid > 0 ? Math.floor(amountPaid / LOYALTY_RUPEES_PER_POINT) : 0;
}
