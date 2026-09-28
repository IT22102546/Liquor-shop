import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";

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
  /** Business details printed on purchase orders and used in supplier emails. */
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  /** Supplier replies go here. */
  businessEmail: string;
  /** Sri Lankan rule: at most this many bottles of hard liquor on one bill (beer is not counted). */
  hardLiquorLimitEnabled: boolean;
  hardLiquorLimit: number;
  /** Categories that count as hard liquor; null = worked out from the category names. */
  hardLiquorCategoryIds: number[] | null;
};

export const DEFAULT_SETTINGS: ShopSettings = {
  loyaltyRedemptionEnabled: false,
  loyaltyRupeesPerPoint: 100,
  loyaltyPointValue: 1,
  discountsEnabled: false,
  maxCashierDiscountPercent: 10,
  businessName: "BAR SHOP",
  businessAddress: "No:154, Puttalam Road, Kurunegala",
  businessPhone: "",
  businessEmail: "",
  hardLiquorLimitEnabled: true,
  hardLiquorLimit: 12,
  hardLiquorCategoryIds: null,
};

/** Spirits by category name (arrack, whisky/“wiskey”, brandy, rum, gin, vodka, liqueur, “hard liquor”…). Beer never matches. */
const SPIRIT_NAMES = /arrack|wh?isk|brandy|\brum\b|\bgin\b|vodka|liqu|tequila|cognac|spirit|scotch|bourbon/i;

/** The category ids that count toward the hard liquor limit. */
export async function hardLiquorCategoryIds(settings?: ShopSettings) {
  const current = settings ?? (await getSettings());
  if (Array.isArray(current.hardLiquorCategoryIds)) return current.hardLiquorCategoryIds;
  const categories = await prisma.inventoryCategory.findMany({ select: { id: true, name: true } });
  return categories.filter((category) => SPIRIT_NAMES.test(category.name)).map((category) => category.id);
}

/**
 * Refuses a bill with more hard liquor bottles than the limit. `lines` are the bill's products with
 * their category and quantity.
 */
export async function assertHardLiquorLimit(lines: Array<{ categoryId: number; quantity: number }>) {
  const settings = await getSettings();
  if (!settings.hardLiquorLimitEnabled) return;
  const hardIds = new Set(await hardLiquorCategoryIds(settings));
  const bottles = lines.filter((line) => hardIds.has(line.categoryId)).reduce((sum, line) => sum + line.quantity, 0);
  if (bottles > settings.hardLiquorLimit) {
    throw new AppError(
      `Hard liquor limit: at most ${settings.hardLiquorLimit} bottles on one bill (Sri Lankan law). This bill has ${bottles}. Beer doesn't count toward the limit.`,
      422,
    );
  }
}

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
