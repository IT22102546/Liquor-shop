import { prisma } from "../../database/prisma.client";

/** Shop feature switches. Everything is off until an admin turns it on. */
export type ShopSettings = {
  /** Registered loyalty members can spend points at the counter. */
  loyaltyRedemptionEnabled: boolean;
  /** Members earn 1 point for every this-many rupees they pay. */
  loyaltyRupeesPerPoint: number;
  /** Rupees taken off the bill for each point a member spends. */
  loyaltyPointValue: number;
  /** Bill discounts (percentage or fixed amount) can be given at the counter. */
  discountsEnabled: boolean;
  /** Largest discount a cashier may give, as a % of the bill. Admins are not limited. */
  maxCashierDiscountPercent: number;
};

export const DEFAULT_SETTINGS: ShopSettings = {
  loyaltyRedemptionEnabled: false,
  loyaltyRupeesPerPoint: 100,
  loyaltyPointValue: 1,
  discountsEnabled: false,
  maxCashierDiscountPercent: 10,
};

const SETTINGS_KEY = "shop";

export async function getSettings(): Promise<ShopSettings> {
  const row = await prisma.posSetting.findUnique({ where: { key: SETTINGS_KEY } });
  const stored = (row?.value && typeof row.value === "object" ? row.value : {}) as Partial<ShopSettings>;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(changes: Partial<ShopSettings>, adminId: number) {
  const next = { ...(await getSettings()), ...changes };
  await prisma.posSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: next, updatedById: adminId },
    create: { key: SETTINGS_KEY, value: next, updatedById: adminId },
  });
  return next;
}
