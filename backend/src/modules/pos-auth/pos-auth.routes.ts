import { Router } from "express";
import * as posAuthController from "./pos-auth.controller";

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

export default router;
