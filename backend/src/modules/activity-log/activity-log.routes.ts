import { Router } from "express";
import { z } from "zod";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";
import { validate } from "../../common/utils/errors";
import { sendSuccess } from "../../common/utils/response";
import { listActivityLogs } from "./activity-log.service";

const activityLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(200).optional(),
  category: z.enum(["AUTH", "SALE", "STOCK", "PRODUCT", "STAFF", "ACCOUNTS", "CASHBOOK", "CUSTOMER", "OTHER"]).optional(),
  actorId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Read-only on purpose: log entries can't be edited or deleted through the API.
const router = Router();
router.use(authenticatePosAdmin);
router.use(authorizePosRoles("ADMIN"));

router.get("/", async (req, res, next) => {
  try {
    return sendSuccess(res, await listActivityLogs(validate(activityLogQuerySchema, req.query)));
  } catch (error) {
    return next(error);
  }
});

export default router;
