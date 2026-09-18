import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { authenticatePosAdmin } from "../../common/middleware/pos-auth.middleware";
import * as ctrl from "./pre-orders.controller";

// ── Upload dir ─────────────────────────────────────────────────────────────
const backendRoot = process.cwd().endsWith("backend")
  ? process.cwd()
  : path.join(process.cwd(), "apps", "backend");
const uploadDir = path.join(backendRoot, "uploads", "pre-orders");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, and AVIF images are allowed"));
  },
});

const uploadPdf = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

// ── Public router (no auth) ────────────────────────────────────────────────
export const publicPreOrdersRouter = Router();
publicPreOrdersRouter.get("/", ctrl.listPublicPreOrders);
publicPreOrdersRouter.get("/:id", ctrl.getPublicPreOrder);

// ── POS Management router (auth required) ─────────────────────────────────
const posRouter = Router();
posRouter.use(authenticatePosAdmin);

posRouter.get("/", ctrl.listPreOrders);
posRouter.get("/:id", ctrl.getPreOrder);
posRouter.post("/", ctrl.createPreOrder);
posRouter.patch("/:id", ctrl.updatePreOrder);
posRouter.delete("/:id", ctrl.deletePreOrder);

posRouter.post(
  "/:preOrderId/images",
  upload.single("image"),
  ctrl.uploadPreOrderImage,
);
posRouter.delete("/:preOrderId/images/:imageId", ctrl.deletePreOrderImage);
posRouter.patch(
  "/:preOrderId/images/:imageId/primary",
  ctrl.setPreOrderImagePrimary,
);

posRouter.post(
  "/:preOrderId/pdf",
  uploadPdf.single("pdf"),
  ctrl.uploadPreOrderPdf,
);

export default posRouter;
