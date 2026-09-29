import { Router, type Request } from "express";
import { z } from "zod";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";
import { validate } from "../../common/utils/errors";
import { sendCreated, sendSuccess } from "../../common/utils/response";
import { requestBranch, requestBranchScope } from "../branches/branch-context";
import { createGrn, getGrn, grnSetup, listGrns } from "./grn.service";
import { cancelGtn, createGtn, getGtn, listGtns, receiveGtn } from "./gtn.service";

const user = (req: Request) => (req as unknown as { user: { id: number; role: string } }).user;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const page = { page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) };
// Receiving and sending goods: branch staff and the office. Accountants can look.
const handlers = authorizePosRoles("ADMIN", "INVENTORY_MANAGER", "CASHIER");
const readers = authorizePosRoles("ADMIN", "INVENTORY_MANAGER", "CASHIER", "ACCOUNTANT");

// ── GRN: goods received from suppliers ──
export const grnRouter = Router();
grnRouter.use(authenticatePosAdmin);
grnRouter.get("/", readers, async (req, res, next) => {
  try {
    const q = validate(z.object({ ...page, search: z.string().trim().max(100).optional(), supplierId: z.coerce.number().int().positive().optional(), from: date.optional(), to: date.optional(), branch: z.string().optional(), branchId: z.string().optional() }), req.query);
    return sendSuccess(res, await listGrns(q, await requestBranchScope(req)));
  } catch (error) { return next(error); }
});
grnRouter.get("/setup", handlers, async (req, res, next) => {
  try { return sendSuccess(res, await grnSetup((await requestBranch(req)).id)); } catch (error) { return next(error); }
});
grnRouter.get("/:id", readers, async (req, res, next) => {
  try { return sendSuccess(res, await getGrn(Number(req.params.id))); } catch (error) { return next(error); }
});
grnRouter.post("/", handlers, async (req, res, next) => {
  try {
    const dto = validate(z.object({
      supplierId: z.number().int().positive("Choose the supplier"),
      purchaseOrderId: z.number().int().positive().nullable().optional(),
      supplierInvoiceNo: z.string().trim().max(60).nullable().optional(),
      invoiceDate: date.nullable().optional(),
      invoiceTotal: z.number().min(0).max(1_000_000_000).nullable().optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
      lines: z.array(z.object({
        productId: z.number().int().positive().nullable().optional(),
        purchaseOrderItemId: z.number().int().positive().nullable().optional(),
        description: z.string().trim().max(200).optional(),
        delivered: z.number().int().min(0).max(1_000_000),
        free: z.number().int().min(0).max(1_000_000).optional(),
        rejected: z.number().int().min(0).max(1_000_000).optional(),
        rejectReason: z.string().trim().max(200).nullable().optional(),
        unitCost: z.number().min(0).max(100_000_000),
      })).min(1, "Add what was delivered").max(300),
    }), req.body);
    return sendCreated(res, await createGrn(dto, user(req).id, (await requestBranch(req)).id));
  } catch (error) { return next(error); }
});

// ── GTN: transfers between branches ──
export const gtnRouter = Router();
gtnRouter.use(authenticatePosAdmin);
gtnRouter.get("/", readers, async (req, res, next) => {
  try {
    const q = validate(z.object({ ...page, direction: z.enum(["in", "out"]).optional(), status: z.enum(["SENT", "RECEIVED", "CANCELLED"]).optional(), search: z.string().trim().max(100).optional(), branch: z.string().optional(), branchId: z.string().optional() }), req.query);
    return sendSuccess(res, await listGtns(q, await requestBranchScope(req)));
  } catch (error) { return next(error); }
});
gtnRouter.get("/:id", readers, async (req, res, next) => {
  try { return sendSuccess(res, await getGtn(Number(req.params.id))); } catch (error) { return next(error); }
});
gtnRouter.post("/", handlers, async (req, res, next) => {
  try {
    const dto = validate(z.object({
      toBranchId: z.number().int().positive("Choose the branch to send to"),
      notes: z.string().trim().max(1000).nullable().optional(),
      carriedBy: z.string().trim().max(120).nullable().optional(),
      lines: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(0).max(1_000_000) })).min(1, "Add the bottles to send").max(300),
    }), req.body);
    return sendCreated(res, await createGtn(dto, user(req).id, (await requestBranch(req)).id));
  } catch (error) { return next(error); }
});
gtnRouter.post("/:id/receive", handlers, async (req, res, next) => {
  try {
    const dto = validate(z.object({
      note: z.string().trim().max(1000).nullable().optional(),
      lines: z.array(z.object({ itemId: z.number().int().positive(), received: z.number().int().min(0).max(1_000_000), damaged: z.number().int().min(0).max(1_000_000) })).min(1),
    }), req.body);
    return sendSuccess(res, await receiveGtn(Number(req.params.id), dto, user(req).id, (await requestBranch(req)).id));
  } catch (error) { return next(error); }
});
gtnRouter.post("/:id/cancel", handlers, async (req, res, next) => {
  try {
    const dto = validate(z.object({ reason: z.string().trim().min(3, "Say why it's cancelled").max(500) }), req.body);
    return sendSuccess(res, await cancelGtn(Number(req.params.id), dto.reason, user(req).id, (await requestBranch(req)).id, user(req).role === "ADMIN"));
  } catch (error) { return next(error); }
});
