import { Router } from "express";
import { authenticatePosAdmin } from "../../common/middleware/pos-auth.middleware";
import * as ctrl from "./contact-requests.controller";

// ── Public router (no auth) ────────────────────────────────────────────────
export const publicContactRequestsRouter = Router();
publicContactRequestsRouter.post("/", ctrl.submitContactRequest);

// ── POS Management router (auth required) ─────────────────────────────────
const posRouter = Router();
posRouter.use(authenticatePosAdmin);

posRouter.get("/stats", ctrl.getContactRequestStats);
posRouter.get("/", ctrl.listContactRequests);
posRouter.get("/:id", ctrl.getContactRequest);
posRouter.patch("/:id", ctrl.updateContactRequest);
posRouter.delete("/:id", ctrl.deleteContactRequest);

export default posRouter;
