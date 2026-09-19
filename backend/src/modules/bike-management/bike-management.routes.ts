import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { authenticatePosAdmin, authorizePosRoles } from "../../common/middleware/pos-auth.middleware";
import * as ctrl from "./bike-management.controller";

const router = Router();
router.use(authenticatePosAdmin);

const adminOnly = authorizePosRoles("ADMIN");
const inventory = authorizePosRoles("ADMIN", "INVENTORY_MANAGER");
const inventoryAndAccounts = authorizePosRoles("ADMIN", "INVENTORY_MANAGER", "ACCOUNTANT");
const productCatalog = authorizePosRoles("ADMIN", "CASHIER", "INVENTORY_MANAGER", "ACCOUNTANT");
const sales = authorizePosRoles("ADMIN", "CASHIER");

// ── Multer config for bike images ───────────────────────────────────────────
// Use process.cwd() for reliable path resolution in both tsx and compiled modes
const backendRoot = process.cwd().endsWith("backend")
  ? process.cwd()
  : path.join(process.cwd(), "apps", "backend");
const uploadDir = path.join(backendRoot, "uploads", "bikes");
const productUploadDir = path.join(backendRoot, "uploads", "products");
for (const dir of [uploadDir, productUploadDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log("[bike-management] Created upload dir:", dir);
  }
}
console.log("[bike-management] Upload dir:", uploadDir, "exists:", fs.existsSync(uploadDir));
console.log("[bike-management] Product upload dir:", productUploadDir, "exists:", fs.existsSync(productUploadDir));

const MAX_IMAGE_COUNT = 6;
const MAX_PRODUCT_IMAGE_COUNT = 3;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const productStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, productUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: MAX_IMAGE_COUNT,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, and AVIF images are allowed"));
  },
});
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

// ── Brands ─────────────────────────────────────────────────────────────────
router.get(   "/brands",                 adminOnly, ctrl.getBrands);
router.post(  "/brands",                 adminOnly, ctrl.createBrand);
router.patch( "/brands/:id",             adminOnly, ctrl.updateBrand);
router.delete("/brands/:id",             adminOnly, ctrl.deleteBrand);

// ── Models ──────────────────────────────────────────────────────────────────
router.get(   "/brands/:brandId/models", adminOnly, ctrl.getModels);
router.post(  "/brands/:brandId/models", adminOnly, ctrl.createModel);
router.get(   "/models",                 adminOnly, ctrl.getAllModels);
router.patch( "/models/:id",             adminOnly, ctrl.updateModel);
router.delete("/models/:id",             adminOnly, ctrl.deleteModel);

// ── Colors ──────────────────────────────────────────────────────────────────
router.get(   "/colors",                 adminOnly, ctrl.getColors);
router.post(  "/colors",                 adminOnly, ctrl.createColor);
router.patch( "/colors/:id",             adminOnly, ctrl.updateColor);
router.delete("/colors/:id",             adminOnly, ctrl.deleteColor);

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
router.post(  "/products/:id/sell",      sales, ctrl.recordProductSale);
router.delete("/products/:id",           inventory, ctrl.deleteProduct);

// ── Vehicles ────────────────────────────────────────────────────────────────
router.get(   "/vehicles/summary",       adminOnly, ctrl.getVehicleSummary);
router.get(   "/vehicles/filenos",       adminOnly, ctrl.getFileNos);
router.patch( "/vehicles/filenos",       adminOnly, ctrl.renameFileNo);
router.delete("/vehicles/filenos",       adminOnly, ctrl.deleteFileNo);
router.get(   "/vehicles",               adminOnly, ctrl.getVehicles);
router.get(   "/vehicles/:id",           adminOnly, ctrl.getVehicle);
router.post(  "/vehicles",               adminOnly, ctrl.createVehicle);
router.post(  "/vehicles/bulk",          adminOnly, ctrl.bulkCreateVehicles);
router.patch( "/vehicles/:id",           adminOnly, ctrl.updateVehicle);
router.delete("/vehicles/:id",           adminOnly, ctrl.deleteVehicle);

// ── Vehicle Expenses ────────────────────────────────────────────────────────
router.get(   "/vehicles/:vehicleId/expenses",              adminOnly, ctrl.getExpenses);
router.post(  "/vehicles/:vehicleId/expenses",              adminOnly, ctrl.addExpense);
router.delete("/vehicles/:vehicleId/expenses/:expenseId",   adminOnly, ctrl.deleteExpense);

// ── Vehicle Images ──────────────────────────────────────────────────────────
router.get(   "/vehicles/:vehicleId/images",                adminOnly, ctrl.getVehicleImages);
router.post(  "/vehicles/:vehicleId/images", adminOnly, upload.array("images", MAX_IMAGE_COUNT), ctrl.uploadVehicleImages);
router.delete("/vehicles/:vehicleId/images/:imageId",       adminOnly, ctrl.deleteVehicleImage);
router.patch( "/vehicles/:vehicleId/images/:imageId/primary", adminOnly, ctrl.setPrimaryImage);

// ── Product Images ──────────────────────────────────────────────────────────
router.get(   "/products/:productId/images",                      inventory, ctrl.getProductImages);
router.post(  "/products/:productId/images", inventory, productUpload.array("images", MAX_PRODUCT_IMAGE_COUNT), ctrl.uploadProductImages);
router.delete("/products/:productId/images/:imageId",             inventory, ctrl.deleteProductImage);
router.patch( "/products/:productId/images/:imageId/primary",     inventory, ctrl.setPrimaryProductImage);

export default router;
