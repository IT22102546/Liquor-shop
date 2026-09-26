import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";
import * as ctrl from "./inventory-management.controller";

const router = Router();
router.use(authenticatePosAdmin);

const inventory = authorizePosRoles("ADMIN", "INVENTORY_MANAGER");
const inventoryAndAccounts = authorizePosRoles("ADMIN", "INVENTORY_MANAGER", "ACCOUNTANT");
const productCatalog = authorizePosRoles("ADMIN", "CASHIER", "INVENTORY_MANAGER", "ACCOUNTANT");
const sales = authorizePosRoles("ADMIN", "CASHIER");

// ── Multer config for product images ────────────────────────────────────────
// Use process.cwd() for reliable path resolution in both tsx and compiled modes
const backendRoot = process.cwd().endsWith("backend")
  ? process.cwd()
  : path.join(process.cwd(), "apps", "backend");
const productUploadDir = path.join(backendRoot, "uploads", "products");
if (!fs.existsSync(productUploadDir)) {
  fs.mkdirSync(productUploadDir, { recursive: true });
  console.log("[inventory-management] Created upload dir:", productUploadDir);
}
console.log("[inventory-management] Product upload dir:", productUploadDir, "exists:", fs.existsSync(productUploadDir));

const MAX_PRODUCT_IMAGE_COUNT = 3;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const productStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, productUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const productUpload = multer({
  storage: productStorage,
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: MAX_PRODUCT_IMAGE_COUNT,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, and AVIF images are allowed"));
  },
});

// ── Suppliers ───────────────────────────────────────────────────────────────
router.get(   "/suppliers",              inventory, ctrl.getSuppliers);
router.post(  "/suppliers",              inventory, ctrl.createSupplier);
router.patch( "/suppliers/:id",          inventory, ctrl.updateSupplier);
router.delete("/suppliers/:id",          inventory, ctrl.deleteSupplier);

// ── Inventory Product Brands & Categories ──────────────────────────────────
router.get(   "/product-brands",         productCatalog, ctrl.getProductBrands);
router.post(  "/product-brands",         inventory, ctrl.createProductBrand);
router.patch( "/product-brands/:id",     inventory, ctrl.updateProductBrand);
router.delete("/product-brands/:id",     inventory, ctrl.deleteProductBrand);

router.get(   "/product-categories",     productCatalog, ctrl.getProductCategories);
router.post(  "/product-categories",     inventory, ctrl.createProductCategory);
router.patch( "/product-categories/:id", inventory, ctrl.updateProductCategory);
router.delete("/product-categories/:id", inventory, ctrl.deleteProductCategory);

// ── Inventory Products ──────────────────────────────────────────────────────
router.get(   "/products",               productCatalog, ctrl.getProducts);
router.get(   "/products/health",        inventoryAndAccounts, ctrl.getInventoryHealth);
router.get(   "/products/:id",           inventoryAndAccounts, ctrl.getProduct);
router.post(  "/products",               inventory, ctrl.createProduct);
router.patch( "/products/:id",           inventory, ctrl.updateProduct);
router.post(  "/products/:id/restock",   inventory, ctrl.restockProduct);
// Cashiers may record empties going back to the supplier (their only change in Product Setup).
router.post(  "/products/:id/empties/return", authorizePosRoles("ADMIN", "INVENTORY_MANAGER", "CASHIER"), ctrl.returnEmptiesToSupplier);
router.post(  "/products/:id/sell",      sales, ctrl.recordProductSale);
router.delete("/products/:id",           inventory, ctrl.deleteProduct);

// ── Product Images ──────────────────────────────────────────────────────────
router.get(   "/products/:productId/images",                      inventory, ctrl.getProductImages);
router.post(  "/products/:productId/images", inventory, productUpload.array("images", MAX_PRODUCT_IMAGE_COUNT), ctrl.uploadProductImages);
router.delete("/products/:productId/images/:imageId",             inventory, ctrl.deleteProductImage);
router.patch( "/products/:productId/images/:imageId/primary",     inventory, ctrl.setPrimaryProductImage);

export default router;
