import { Router, type Request } from "express";
import { z } from "zod";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";
import { validate } from "../../common/utils/errors";
import { sendCreated, sendSuccess } from "../../common/utils/response";
import { requestBranch, requestBranchScope } from "../branches/branch-context";
import { VOUCHER_KINDS, VOUCHER_PAYMENT_METHODS, cancelVoucher, checkVoucher, createVouchers, getVoucherForPrint, listVouchers } from "./gift-vouchers.service";

const user = (req: Request) => (req as unknown as { user: { id: number } }).user;

// Gift vouchers: administrators issue and cancel; accountants can see them; cashiers check a code at the counter.
const router = Router();
router.use(authenticatePosAdmin);

router.get("/", authorizePosRoles("ADMIN", "ACCOUNTANT"), async (req, res, next) => {
  try {
    const q = validate(z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      status: z.enum(["ACTIVE", "REDEEMED", "CANCELLED", "EXPIRED"]).optional(),
      kind: z.enum(VOUCHER_KINDS).optional(),
      search: z.string().trim().max(60).optional(),
      branch: z.string().optional(),
      branchId: z.string().optional(),
    }), req.query);
    return sendSuccess(res, await listVouchers({ ...q, branchId: await requestBranchScope(req) }));
  } catch (error) { return next(error); }
});

router.get("/check/:code", authorizePosRoles("ADMIN", "CASHIER"), async (req, res, next) => {
  try { return sendSuccess(res, await checkVoucher(String(req.params.code ?? ""))); } catch (error) { return next(error); }
});

router.get("/:id/print", authorizePosRoles("ADMIN"), async (req, res, next) => {
  try { return sendSuccess(res, await getVoucherForPrint(Number(req.params.id))); } catch (error) { return next(error); }
});

router.post("/", authorizePosRoles("ADMIN"), async (req, res, next) => {
  try {
    const dto = validate(z.object({
      amount: z.number().positive("Enter the voucher amount").max(10_000_000),
      kind: z.enum(VOUCHER_KINDS),
      quantity: z.number().int().min(1).max(50).default(1),
      expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      issuedTo: z.string().trim().max(120).nullable().optional(),
      issuedPhone: z.string().trim().max(20).nullable().optional(),
      customerId: z.number().int().positive().nullable().optional(),
      note: z.string().trim().max(500).nullable().optional(),
      paymentMethod: z.enum(VOUCHER_PAYMENT_METHODS).nullable().optional(),
      paymentReference: z.string().trim().max(60).nullable().optional(),
    }), req.body);
    return sendCreated(res, await createVouchers(dto, user(req).id, (await requestBranch(req)).id));
  } catch (error) { return next(error); }
});

router.post("/:id/cancel", authorizePosRoles("ADMIN"), async (req, res, next) => {
  try {
    const dto = validate(z.object({ reason: z.string().trim().min(3, "Say why the voucher is cancelled").max(300) }), req.body);
    return sendSuccess(res, await cancelVoucher(Number(req.params.id), dto.reason, user(req).id));
  } catch (error) { return next(error); }
});

export default router;
