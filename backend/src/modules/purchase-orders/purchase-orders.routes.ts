import { prisma } from "../../database/prisma.client";
import { requestBranch } from "../branches/branch-context";
import { Router, type Request } from "express";
import { z } from "zod";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";
import { AppError, validate } from "../../common/utils/errors";
import { sendCreated, sendSuccess } from "../../common/utils/response";
import { cancelOrder, createOrder, emailStatus, getOrder, listOrders, receiveOrder, sendOrder, updateOrder } from "./purchase-orders.service";

const user = (req: Request) => (req as unknown as { user: { id: number } }).user;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const orderSchema = z.object({
  /** The branch the order is for (only the main branch may choose another branch). */
  branchId: z.number().int().positive().nullable().optional(),
  supplierId: z.number().int().positive("Choose a supplier"),
  expectedDate: date.nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(z.object({
    productId: z.number().int().positive().nullable().optional(),
    description: z.string().trim().max(200).optional(),
    quantity: z.number().int().min(1, "Quantity must be at least 1").max(1_000_000),
    unitCost: z.number().min(0, "Price can't be negative").max(100_000_000),
    /** Free issue agreed with the supplier, e.g. 10 + 2 free. */
    freeQty: z.number().int().min(0).max(1_000_000).optional(),
  })).min(1, "Add at least one item").max(200),
});
const emailList = z.string().trim().max(500).refine(
  (value) => value === "" || value.split(",").every((part) => z.string().email().safeParse(part.trim()).success),
  "Enter valid email addresses, separated by commas",
);

// Purchase orders are for administrators only.
const router = Router();
router.use(authenticatePosAdmin);
router.use(authorizePosRoles("ADMIN"));

/**
 * Branches see only their own orders: working at a sub branch, an order for another branch can't be
 * opened, changed, sent, received or cancelled. The main branch sees every branch's orders.
 */
router.param("id", async (req, _res, next, id) => {
  try {
    const working = await requestBranch(req);
    if (working.isMain || !/^\d+$/.test(String(id))) return next();
    const order = await prisma.purchaseOrder.findUnique({ where: { id: Number(id) }, select: { branchId: true, poNumber: true } });
    if (order && order.branchId !== working.id) throw AppError.forbidden(`${order.poNumber} belongs to another branch`);
    return next();
  } catch (error) { return next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const q = validate(z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      status: z.enum(["DRAFT", "SENT", "PARTIAL", "RECEIVED", "CANCELLED"]).optional(),
      supplierId: z.coerce.number().int().positive().optional(),
      search: z.string().trim().max(100).optional(),
      from: date.optional(),
      to: date.optional(),
      branchId: z.coerce.number().int().positive().optional(),
    }), req.query);
    // A sub branch sees only its own orders; the main branch sees all, or one branch when filtered.
    const working = await requestBranch(req);
    return sendSuccess(res, await listOrders({ ...q, branchId: working.isMain ? q.branchId : working.id }));
  } catch (error) { return next(error); }
});
router.get("/email-status", (_req, res) => sendSuccess(res, emailStatus()));
router.get("/:id", async (req, res, next) => {
  try { return sendSuccess(res, await getOrder(Number(req.params.id))); } catch (error) { return next(error); }
});
router.post("/", async (req, res, next) => {
  try { return sendCreated(res, await createOrder(validate(orderSchema, req.body), user(req).id, await requestBranch(req))); } catch (error) { return next(error); }
});
router.patch("/:id", async (req, res, next) => {
  try { return sendSuccess(res, await updateOrder(Number(req.params.id), validate(orderSchema, req.body), await requestBranch(req))); } catch (error) { return next(error); }
});
router.post("/:id/send", async (req, res, next) => {
  try {
    const dto = validate(z.object({
      to: emailList.refine((value) => value !== "", "Enter the supplier's email address"),
      cc: emailList.optional(),
      subject: z.string().trim().min(3, "Enter a subject").max(200),
      message: z.string().trim().max(3000),
    }), req.body);
    return sendSuccess(res, await sendOrder(Number(req.params.id), dto, user(req).id));
  } catch (error) { return next(error); }
});
router.post("/:id/receive", async (req, res, next) => {
  try {
    const dto = validate(z.object({
      lines: z.array(z.object({
        itemId: z.number().int().positive(),
        quantity: z.number().int().min(0).max(1_000_000),
        rejected: z.number().int().min(0).max(1_000_000).optional(),
        rejectReason: z.string().trim().max(200).nullable().optional(),
        free: z.number().int().min(0).max(1_000_000).optional(),
        unitCost: z.number().min(0).max(100_000_000).optional(),
      })).min(1),
      supplierInvoiceNo: z.string().trim().max(60).nullable().optional(),
      invoiceDate: date.nullable().optional(),
      invoiceTotal: z.number().min(0).max(1_000_000_000).nullable().optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
    }), req.body);
    return sendSuccess(res, await receiveOrder(Number(req.params.id), dto, user(req).id, (await requestBranch(req)).id));
  } catch (error) { return next(error); }
});
router.post("/:id/cancel", async (req, res, next) => {
  try {
    const dto = validate(z.object({ reason: z.string().trim().min(3, "Give a reason for cancelling").max(500) }), req.body);
    return sendSuccess(res, await cancelOrder(Number(req.params.id), dto.reason, user(req).id));
  } catch (error) { return next(error); }
});

export default router;
