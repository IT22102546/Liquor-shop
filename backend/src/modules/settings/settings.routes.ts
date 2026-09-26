import { Router } from "express";
import { z } from "zod";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";
import { validate } from "../../common/utils/errors";
import { sendSuccess } from "../../common/utils/response";
import { getSettings, updateSettings } from "./settings.service";

const updateSettingsSchema = z
  .object({
    loyaltyRedemptionEnabled: z.boolean(),
    loyaltyRupeesPerPoint: z.number().min(1, "Must be at least Rs. 1").max(1_000_000),
    loyaltyPointValue: z.number().min(0.01, "A point must be worth more than Rs. 0").max(100_000),
    discountsEnabled: z.boolean(),
    maxCashierDiscountPercent: z.number().min(0).max(100),
  })
  .partial();

const router = Router();
router.use(authenticatePosAdmin);

// Every signed-in staff member needs the switches (the counter shows/hides options with them).
router.get("/", async (_req, res, next) => {
  try { return sendSuccess(res, await getSettings()); } catch (error) { return next(error); }
});

router.patch("/", authorizePosRoles("ADMIN"), async (req, res, next) => {
  try {
    const adminId = (req as unknown as { user: { id: number } }).user.id;
    return sendSuccess(res, await updateSettings(validate(updateSettingsSchema, req.body), adminId));
  } catch (error) { return next(error); }
});

export default router;
