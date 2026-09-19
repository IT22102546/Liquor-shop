import { Router } from "express";
import * as posAuthController from "./pos-auth.controller";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";

const router = Router();

/**
 * POST /api/pos/auth/login
 * POS admin login endpoint.
 */
router.post("/login", posAuthController.login);

/**
 * GET /api/pos/auth/me
 * Returns current POS admin profile for a valid bearer token.
 */
router.get("/me", posAuthController.me);

router.get("/staff", authenticatePosAdmin, authorizePosRoles("ADMIN"), posAuthController.listStaff);
router.post("/staff", authenticatePosAdmin, authorizePosRoles("ADMIN"), posAuthController.createStaff);
router.patch("/staff/:id", authenticatePosAdmin, authorizePosRoles("ADMIN"), posAuthController.updateStaff);

export default router;
