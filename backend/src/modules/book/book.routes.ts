import { Router, type Request } from "express";
import { z } from "zod";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";
import { AppError, validate } from "../../common/utils/errors";
import { sendCreated, sendSuccess } from "../../common/utils/response";
import { createCashEntry, listCashEntries, markBanked, unmarkBanked, voidCashEntry } from "./cash-book.service";
import { closeShift, countShift, DENOMINATIONS, getCurrentShift, getShiftReport, listShifts, openShift } from "./shift.service";

const user = (req: Request) => (req as unknown as { user: { id: number; role: string } }).user;
const money = z.number().min(0).max(100_000_000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ── Shifts (Day End) ─────────────────────────────────────────────────────────
export const shiftRouter = Router();
shiftRouter.use(authenticatePosAdmin);
const tillStaff = authorizePosRoles("ADMIN", "CASHIER");
const bookReaders = authorizePosRoles("ADMIN", "CASHIER", "ACCOUNTANT");

shiftRouter.get("/current", bookReaders, async (_req, res, next) => {
  try { return sendSuccess(res, { ...(await getCurrentShift()), denominations: DENOMINATIONS }); } catch (error) { return next(error); }
});
shiftRouter.get("/", bookReaders, async (req, res, next) => {
  try {
    const q = validate(z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }), req.query);
    return sendSuccess(res, await listShifts(q.page, q.limit));
  } catch (error) { return next(error); }
});
shiftRouter.post("/open", tillStaff, async (req, res, next) => {
  try {
    const dto = validate(z.object({ openingFloat: money }), req.body);
    return sendCreated(res, await openShift(dto.openingFloat, user(req).id));
  } catch (error) { return next(error); }
});
shiftRouter.get("/:id/report", bookReaders, async (req, res, next) => {
  try { return sendSuccess(res, await getShiftReport(Number(req.params.id), user(req).role !== "CASHIER")); } catch (error) { return next(error); }
});
shiftRouter.post("/:id/count", tillStaff, async (req, res, next) => {
  try {
    const dto = validate(z.object({ counts: z.record(z.string(), z.number().int().min(0).max(100_000)) }), req.body);
    return sendSuccess(res, await countShift(Number(req.params.id), dto.counts, user(req).id));
  } catch (error) { return next(error); }
});
shiftRouter.post("/:id/close", tillStaff, async (req, res, next) => {
  try {
    const dto = validate(z.object({
      floatLeft: money,
      differenceReason: z.string().trim().max(500).optional(),
      cardSlipTotal: money.optional(),
      cardDifferenceReason: z.string().trim().max(500).optional(),
      notes: z.string().trim().max(1000).optional(),
      stockCounts: z.array(z.object({ productId: z.number().int().positive(), counted: z.number().int().min(0).max(1_000_000) })).max(2000).optional(),
    }), req.body);
    return sendSuccess(res, await closeShift(Number(req.params.id), dto, user(req).id));
  } catch (error) { return next(error); }
});

// ── Cash book: receipts (money in) and vouchers (money out / expenses) ───────
export const cashBookRouter = Router();
cashBookRouter.use(authenticatePosAdmin);

cashBookRouter.get("/", bookReaders, async (req, res, next) => {
  try {
    const q = validate(z.object({
      direction: z.enum(["IN", "OUT"]),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(200).default(30),
      category: z.string().max(40).optional(),
      source: z.enum(["DRAWER", "BANK", "OWNER"]).optional(),
      from: date.optional(),
      to: date.optional(),
      search: z.string().trim().max(100).optional(),
      shiftId: z.coerce.number().int().positive().optional(),
      bankStatus: z.enum(["PENDING", "BANKED"]).optional(),
    }), req.query);
    return sendSuccess(res, await listCashEntries(q));
  } catch (error) { return next(error); }
});
cashBookRouter.post("/", bookReaders, async (req, res, next) => {
  try {
    const dto = validate(z.object({
      direction: z.enum(["IN", "OUT"]),
      category: z.string().min(1).max(40),
      amount: z.number().positive("Amount must be more than 0").max(100_000_000),
      source: z.enum(["DRAWER", "BANK", "OWNER"]),
      party: z.string().trim().max(200).optional(),
      reference: z.string().trim().max(100).optional(),
      note: z.string().trim().max(1000).optional(),
      entryDate: date.optional(),
    }), req.body);
    // Cashiers record what goes in or out of their till; bank/owner entries are for the office.
    if (user(req).role === "CASHIER" && dto.source !== "DRAWER") {
      throw AppError.forbidden("Cashiers can only record cash going in or out of the drawer");
    }
    return sendCreated(res, await createCashEntry(dto, user(req).id));
  } catch (error) { return next(error); }
});
// Deposit slip: mark one or more shift takings as banked (cash deposited / card & QR money received).
cashBookRouter.post("/bank", authorizePosRoles("ADMIN", "ACCOUNTANT"), async (req, res, next) => {
  try {
    const dto = validate(z.object({
      ids: z.array(z.number().int().positive()).min(1, "Choose at least one entry").max(200),
      reference: z.string().trim().max(100).optional(),
      date: date.optional(),
    }), req.body);
    return sendSuccess(res, await markBanked([...new Set(dto.ids)], dto.reference, dto.date, user(req).id));
  } catch (error) { return next(error); }
});
cashBookRouter.post("/:id/unbank", authorizePosRoles("ADMIN"), async (req, res, next) => {
  try { return sendSuccess(res, await unmarkBanked(Number(req.params.id))); } catch (error) { return next(error); }
});
cashBookRouter.post("/:id/void", authorizePosRoles("ADMIN", "ACCOUNTANT"), async (req, res, next) => {
  try {
    const dto = validate(z.object({ reason: z.string().trim().min(3, "Give a reason for voiding").max(500) }), req.body);
    return sendSuccess(res, await voidCashEntry(Number(req.params.id), dto.reason, user(req).id));
  } catch (error) { return next(error); }
});
