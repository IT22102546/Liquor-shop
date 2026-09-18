import { Router } from "express";
import * as bikesController from "./bikes.controller";
import { authenticate } from "../../common/middleware/auth.middleware";
import { authorize } from "../../common/middleware/auth.middleware";

const router = Router();

// ── Public vehicle listing (no auth required) ────────────────────────────────
router.get("/vehicles", bikesController.listPublicVehicles);
router.get("/vehicles/:id", bikesController.getPublicVehicleById);

// ── Public product (spare parts) listing (no auth required) ──────────────────
router.get("/products", bikesController.listPublicProducts);
router.get("/products/:id", bikesController.getPublicProductById);

router.get("/", bikesController.listBikes);
router.get("/:id", bikesController.getBike);
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "STAFF"),
  bikesController.createBike,
);
router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "STAFF"),
  bikesController.updateBike,
);
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  bikesController.deleteBike,
);

export default router;
