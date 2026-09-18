import { Router } from "express";
import * as exportVehiclesController from "./export-vehicles.controller";

const router = Router();

// GET /api/export-vehicles/:category  — e.g. /automobile or /heavy-machinery
router.get("/:category", exportVehiclesController.listByCategory);
router.get("/:category/:id", exportVehiclesController.getById);

export default router;
