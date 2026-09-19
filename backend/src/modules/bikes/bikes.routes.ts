import { Router } from "express";
import * as bikesController from "./bikes.controller";

const router = Router();

// ── Public product (liquor catalog) listing (no auth required) ───────────────
router.get("/products", bikesController.listPublicProducts);
router.get("/products/:id", bikesController.getPublicProductById);

export default router;
