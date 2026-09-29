import { Router, type Request } from "express";
import { z } from "zod";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";
import { validate } from "../../common/utils/errors";
import { sendCreated, sendSuccess } from "../../common/utils/response";
import { createBranch, currentBranch, listBranches, stockByBranch, switchBranch, updateBranch } from "./branches.service";

const user = (req: Request) => (req as unknown as { user: { id: number; role: string } }).user;
const branchSchema = z.object({
  code: z.string().trim().min(2, "Give a short code, e.g. KDY").max(10).regex(/^[A-Za-z0-9-]+$/, "Letters and numbers only"),
  name: z.string().trim().min(2, "Name the branch").max(80),
  address: z.string().trim().max(300).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.union([z.string().trim().email("Enter a valid email address").max(120), z.literal(""), z.null()]).optional(),
});

const router = Router();
router.use(authenticatePosAdmin);

// Everyone signed in: where they work, and the branch list (for pickers).
router.get("/", async (req, res, next) => {
  try { return sendSuccess(res, await listBranches(req.query.all === "1" && user(req).role === "ADMIN")); } catch (error) { return next(error); }
});
router.get("/current", async (req, res, next) => {
  try { return sendSuccess(res, await currentBranch(user(req).id)); } catch (error) { return next(error); }
});
router.post("/switch", async (req, res, next) => {
  try {
    const dto = validate(z.object({ branchId: z.number().int().positive() }), req.body);
    return sendSuccess(res, await switchBranch(user(req).id, dto.branchId));
  } catch (error) { return next(error); }
});
router.get("/stock", async (req, res, next) => {
  try {
    const ids = typeof req.query.productIds === "string" && req.query.productIds ? req.query.productIds.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0) : undefined;
    return sendSuccess(res, await stockByBranch(ids));
  } catch (error) { return next(error); }
});

// Adding and changing branches is for administrators.
router.post("/", authorizePosRoles("ADMIN"), async (req, res, next) => {
  try { return sendCreated(res, await createBranch(validate(branchSchema, req.body))); } catch (error) { return next(error); }
});
router.patch("/:id", authorizePosRoles("ADMIN"), async (req, res, next) => {
  try {
    const dto = validate(branchSchema.partial().extend({ isActive: z.boolean().optional() }), req.body);
    return sendSuccess(res, await updateBranch(Number(req.params.id), dto));
  } catch (error) { return next(error); }
});

export default router;
