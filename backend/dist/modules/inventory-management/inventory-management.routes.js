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
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const pos_auth_middleware_1 = require("../../common/middleware/pos-auth.middleware");
const ctrl = __importStar(require("./inventory-management.controller"));
const router = (0, express_1.Router)();
router.use(pos_auth_middleware_1.authenticatePosAdmin);
const inventory = (0, pos_auth_middleware_1.authorizePosRoles)("ADMIN", "INVENTORY_MANAGER");
const inventoryAndAccounts = (0, pos_auth_middleware_1.authorizePosRoles)("ADMIN", "INVENTORY_MANAGER", "ACCOUNTANT");
const productCatalog = (0, pos_auth_middleware_1.authorizePosRoles)("ADMIN", "CASHIER", "INVENTORY_MANAGER", "ACCOUNTANT");
const sales = (0, pos_auth_middleware_1.authorizePosRoles)("ADMIN", "CASHIER");
const backendRoot = process.cwd().endsWith("backend")
    ? process.cwd()
    : path_1.default.join(process.cwd(), "apps", "backend");
const productUploadDir = path_1.default.join(backendRoot, "uploads", "products");
if (!fs_1.default.existsSync(productUploadDir)) {
    fs_1.default.mkdirSync(productUploadDir, { recursive: true });
    console.log("[inventory-management] Created upload dir:", productUploadDir);
}
console.log("[inventory-management] Product upload dir:", productUploadDir, "exists:", fs_1.default.existsSync(productUploadDir));
const MAX_PRODUCT_IMAGE_COUNT = 3;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const productStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, productUploadDir),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `${crypto_1.default.randomUUID()}${ext}`);
    },
});
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const productUpload = (0, multer_1.default)({
    storage: productStorage,
    limits: {
        fileSize: MAX_IMAGE_SIZE_BYTES,
        files: MAX_PRODUCT_IMAGE_COUNT,
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_TYPES.includes(file.mimetype))
            cb(null, true);
        else
            cb(new Error("Only JPEG, PNG, WebP, and AVIF images are allowed"));
    },
});
router.get("/suppliers", inventory, ctrl.getSuppliers);
router.post("/suppliers", inventory, ctrl.createSupplier);
router.patch("/suppliers/:id", inventory, ctrl.updateSupplier);
router.delete("/suppliers/:id", inventory, ctrl.deleteSupplier);
router.get("/product-brands", productCatalog, ctrl.getProductBrands);
router.post("/product-brands", inventory, ctrl.createProductBrand);
router.patch("/product-brands/:id", inventory, ctrl.updateProductBrand);
router.delete("/product-brands/:id", inventory, ctrl.deleteProductBrand);
router.get("/product-categories", productCatalog, ctrl.getProductCategories);
router.post("/product-categories", inventory, ctrl.createProductCategory);
router.patch("/product-categories/:id", inventory, ctrl.updateProductCategory);
router.delete("/product-categories/:id", inventory, ctrl.deleteProductCategory);
router.get("/products", productCatalog, ctrl.getProducts);
router.get("/products/health", inventoryAndAccounts, ctrl.getInventoryHealth);
router.get("/products/:id", inventoryAndAccounts, ctrl.getProduct);
router.post("/products", inventory, ctrl.createProduct);
router.patch("/products/:id", inventory, ctrl.updateProduct);
router.post("/products/:id/sell", sales, ctrl.recordProductSale);
router.delete("/products/:id", inventory, ctrl.deleteProduct);
router.get("/products/:productId/images", inventory, ctrl.getProductImages);
router.post("/products/:productId/images", inventory, productUpload.array("images", MAX_PRODUCT_IMAGE_COUNT), ctrl.uploadProductImages);
router.delete("/products/:productId/images/:imageId", inventory, ctrl.deleteProductImage);
router.patch("/products/:productId/images/:imageId/primary", inventory, ctrl.setPrimaryProductImage);
exports.default = router;
