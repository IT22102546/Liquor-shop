"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicPreOrdersRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const pos_auth_middleware_1 = require("../../common/middleware/pos-auth.middleware");
const ctrl = __importStar(require("./pre-orders.controller"));
const backendRoot = process.cwd().endsWith("backend")
    ? process.cwd()
    : path_1.default.join(process.cwd(), "apps", "backend");
const uploadDir = path_1.default.join(backendRoot, "uploads", "pre-orders");
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `${crypto_1.default.randomUUID()}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 6 },
    fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
        if (allowed.includes(file.mimetype))
            cb(null, true);
        else
            cb(new Error("Only JPEG, PNG, WebP, and AVIF images are allowed"));
    },
});
const uploadPdf = (0, multer_1.default)({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === "application/pdf")
            cb(null, true);
        else
            cb(new Error("Only PDF files are allowed"));
    },
});
exports.publicPreOrdersRouter = (0, express_1.Router)();
exports.publicPreOrdersRouter.get("/", ctrl.listPublicPreOrders);
exports.publicPreOrdersRouter.get("/:id", ctrl.getPublicPreOrder);
const posRouter = (0, express_1.Router)();
posRouter.use(pos_auth_middleware_1.authenticatePosAdmin);
posRouter.use((0, pos_auth_middleware_1.authorizePosRoles)("ADMIN", "INVENTORY_MANAGER"));
posRouter.get("/", ctrl.listPreOrders);
posRouter.get("/:id", ctrl.getPreOrder);
posRouter.post("/", ctrl.createPreOrder);
posRouter.patch("/:id", ctrl.updatePreOrder);
posRouter.delete("/:id", ctrl.deletePreOrder);
posRouter.post("/:preOrderId/images", upload.single("image"), ctrl.uploadPreOrderImage);
posRouter.delete("/:preOrderId/images/:imageId", ctrl.deletePreOrderImage);
posRouter.patch("/:preOrderId/images/:imageId/primary", ctrl.setPreOrderImagePrimary);
posRouter.post("/:preOrderId/pdf", uploadPdf.single("pdf"), ctrl.uploadPreOrderPdf);
exports.default = posRouter;
