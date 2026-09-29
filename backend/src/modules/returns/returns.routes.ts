import { requestBranch, requestBranchScope } from "../branches/branch-context";
import { Router, type Request } from "express";
import { z } from "zod";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";
import { validate } from "../../common/utils/errors";
import { sendCreated, sendSuccess } from "../../common/utils/response";
import { RETURN_TYPES, clearDamaged, createExchange, createRefund, createStoreDamage, findBills, getBillForReturn, getOverview, getReturn, listReturns } from "./returns.service";

const user = (req: Request) => (req as unknown as { user: { id: number } }).user;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const quantity = z.number().int().min(1, "Enter at least 1 bottle").max(10_000);
const reason = z.string().trim().min(2, "Say what happened").max(200);
const note = z.string().trim().max(500).nullable().optional();

// Returns & damages: cashiers and administrators. Clearing damaged stock is for administrators only.
const router = Router();
router.use(authenticatePosAdmin);
router.use(authorizePosRoles("ADMIN", "CASHIER"));

router.get("/", async (req, res, next) => {
  try {
    const q = validate(z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      type: z.enum(RETURN_TYPES).optional(),
      from: date.optional(),
      to: date.optional(),
      search: z.string().trim().max(100).optional(),
    }), req.query);
    return sendSuccess(res, await listReturns(q, await requestBranchScope(req)));
  } catch (error) { return next(error); }
});

router.get("/overview", async (req, res, next) => {
  try { return sendSuccess(res, await getOverview((await requestBranch(req)).id)); } catch (error) { return next(error); }
});

router.get("/bills", async (req, res, next) => {
  try {
    const q = validate(z.object({ search: z.string().trim().max(60).optional() }), req.query);
    return sendSuccess(res, await findBills(q.search));
  } catch (error) { return next(error); }
});

router.get("/bills/:billNo", async (req, res, next) => {
  try { return sendSuccess(res, await getBillForReturn(String(req.params.billNo))); } catch (error) { return next(error); }
});

router.get("/:returnNo", async (req, res, next) => {
  try { return sendSuccess(res, await getReturn(String(req.params.returnNo))); } catch (error) { return next(error); }
});

router.post("/exchange", async (req, res, next) => {
  try {
    const dto = validate(z.object({
      productId: z.number().int().positive("Choose a product"),
      quantity,
      billNo: z.string().trim().max(60).nullable().optional(),
      customerName: z.string().trim().max(120).nullable().optional(),
      customerMobile: z.string().trim().max(20).nullable().optional(),
      reason,
      note,
    }), req.body);
    return sendCreated(res, await createExchange(dto, user(req).id, (await requestBranch(req)).id));
  } catch (error) { return next(error); }
});

router.post("/refund", async (req, res, next) => {
  try {
    const dto = validate(z.object({
      billNo: z.string().trim().min(1, "Choose the bill").max(60),
      lines: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(0).max(10_000), condition: z.enum(["SHELF", "DAMAGED"]) })).min(1).max(100),
      method: z.enum(["CASH", "WALLET"]),
      reason,
      note,
    }), req.body);
    return sendCreated(res, await createRefund(dto, user(req).id, (await requestBranch(req)).id));
  } catch (error) { return next(error); }
});

router.post("/damage", async (req, res, next) => {
  try {
    const dto = validate(z.object({ productId: z.number().int().positive("Choose a product"), quantity, reason, note }), req.body);
    return sendCreated(res, await createStoreDamage(dto, user(req).id, (await requestBranch(req)).id));
  } catch (error) { return next(error); }
});

router.post("/clear", authorizePosRoles("ADMIN"), async (req, res, next) => {
  try {
    const dto = validate(z.object({
      productId: z.number().int().positive("Choose a product"),
      quantity,
      disposal: z.enum(["SUPPLIER", "WRITTEN_OFF", "RESTORED"]),
      reason,
      reference: z.string().trim().max(100).nullable().optional(),
      note,
    }), req.body);
    return sendCreated(res, await clearDamaged(dto, user(req).id, (await requestBranch(req)).id));
  } catch (error) { return next(error); }
});

export default router;
