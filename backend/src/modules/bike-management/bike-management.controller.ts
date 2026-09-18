import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import { AppError, validate } from "../../common/utils/errors";
import { sendSuccess, sendCreated } from "../../common/utils/response";
import {
  createBrandSchema, updateBrandSchema,
  createModelSchema, updateModelSchema,
  createColorSchema, updateColorSchema,
} from "./dto/brand.dto";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "./dto/supplier.dto";
import {
  createProductBrandSchema,
  updateProductBrandSchema,
  createProductCategorySchema,
  updateProductCategorySchema,
  createProductSchema,
  updateProductSchema,
  recordProductSaleSchema,
  productQuerySchema,
} from "./dto/product.dto";
import {
  createVehicleSchema,
  bulkCreateVehicleSchema,
  updateVehicleSchema,
  vehicleQuerySchema,
  renameFileNoSchema,
  deleteFileNoSchema,
  addExpenseSchema,
} from "./dto/vehicle.dto";
import * as service from "./bike-management.service";

const MAX_TOTAL_IMAGE_BYTES = 60 * 1024 * 1024;

// ── Brands ─────────────────────────────────────────────────────────────────
export async function getBrands(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listBrands()); } catch (err) { return next(err); }
}
export async function createBrand(req: Request, res: Response, next: NextFunction) {
  try { return sendCreated(res, await service.createBrand(validate(createBrandSchema, req.body))); } catch (err) { return next(err); }
}
export async function updateBrand(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.updateBrand(Number(req.params.id), validate(updateBrandSchema, req.body))); } catch (err) { return next(err); }
}
export async function deleteBrand(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteBrand(Number(req.params.id)); return sendSuccess(res, { message: "Brand and all related data deleted" }); } catch (err) { return next(err); }
}

// ── Models ─────────────────────────────────────────────────────────────────
export async function getModels(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listModels(Number(req.params.brandId))); } catch (err) { return next(err); }
}
export async function getAllModels(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listAllModels()); } catch (err) { return next(err); }
}
export async function createModel(req: Request, res: Response, next: NextFunction) {
  try { return sendCreated(res, await service.createModel(Number(req.params.brandId), validate(createModelSchema, req.body))); } catch (err) { return next(err); }
}
export async function updateModel(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.updateModel(Number(req.params.id), validate(updateModelSchema, req.body))); } catch (err) { return next(err); }
}
export async function deleteModel(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteModel(Number(req.params.id)); return sendSuccess(res, { message: "Model and all related vehicles deleted" }); } catch (err) { return next(err); }
}

// ── Colors ─────────────────────────────────────────────────────────────────
export async function getColors(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listColors()); } catch (err) { return next(err); }
}
export async function createColor(req: Request, res: Response, next: NextFunction) {
  try { return sendCreated(res, await service.createColor(validate(createColorSchema, req.body))); } catch (err) { return next(err); }
}
export async function updateColor(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.updateColor(Number(req.params.id), validate(updateColorSchema, req.body))); } catch (err) { return next(err); }
}
export async function deleteColor(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteColor(Number(req.params.id)); return sendSuccess(res, { message: "Color deleted" }); } catch (err) { return next(err); }
}

// ── Suppliers ──────────────────────────────────────────────────────────────
export async function getSuppliers(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listSuppliers()); } catch (err) { return next(err); }
}
export async function createSupplier(req: Request, res: Response, next: NextFunction) {
  try { return sendCreated(res, await service.createSupplier(validate(createSupplierSchema, req.body))); } catch (err) { return next(err); }
}
export async function updateSupplier(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.updateSupplier(Number(req.params.id), validate(updateSupplierSchema, req.body))); } catch (err) { return next(err); }
}
export async function deleteSupplier(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteSupplier(Number(req.params.id)); return sendSuccess(res, { message: "Supplier deleted" }); } catch (err) { return next(err); }
}

// ── Inventory Products ─────────────────────────────────────────────────────
export async function getProductBrands(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listProductBrands()); } catch (err) { return next(err); }
}
export async function createProductBrand(req: Request, res: Response, next: NextFunction) {
  try { return sendCreated(res, await service.createProductBrand(validate(createProductBrandSchema, req.body))); } catch (err) { return next(err); }
}
export async function updateProductBrand(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.updateProductBrand(Number(req.params.id), validate(updateProductBrandSchema, req.body))); } catch (err) { return next(err); }
}
export async function deleteProductBrand(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteProductBrand(Number(req.params.id)); return sendSuccess(res, { message: "Product brand deleted" }); } catch (err) { return next(err); }
}

export async function getProductCategories(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listProductCategories()); } catch (err) { return next(err); }
}
export async function createProductCategory(req: Request, res: Response, next: NextFunction) {
  try { return sendCreated(res, await service.createProductCategory(validate(createProductCategorySchema, req.body))); } catch (err) { return next(err); }
}
export async function updateProductCategory(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.updateProductCategory(Number(req.params.id), validate(updateProductCategorySchema, req.body))); } catch (err) { return next(err); }
}
export async function deleteProductCategory(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteProductCategory(Number(req.params.id)); return sendSuccess(res, { message: "Product category deleted" }); } catch (err) { return next(err); }
}

export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listProducts(validate(productQuerySchema, req.query))); } catch (err) { return next(err); }
}
export async function getInventoryHealth(_req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.getInventoryHealth()); } catch (err) { return next(err); }
}
export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.getProduct(Number(req.params.id))); } catch (err) { return next(err); }
}
export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try { return sendCreated(res, await service.createProduct(validate(createProductSchema, req.body))); } catch (err) { return next(err); }
}
export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.updateProduct(Number(req.params.id), validate(updateProductSchema, req.body))); } catch (err) { return next(err); }
}
export async function recordProductSale(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.recordProductSale(Number(req.params.id), validate(recordProductSaleSchema, req.body))); } catch (err) { return next(err); }
}
export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteProduct(Number(req.params.id)); return sendSuccess(res, { message: "Product deleted" }); } catch (err) { return next(err); }
}

// ── Vehicles ───────────────────────────────────────────────────────────────
export async function getVehicleSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    return sendSuccess(res, await service.vehicleSummary(status));
  } catch (err) { return next(err); }
}
export async function getVehicles(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listVehicles(validate(vehicleQuerySchema, req.query))); } catch (err) { return next(err); }
}
export async function getVehicle(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.getVehicle(Number(req.params.id))); } catch (err) { return next(err); }
}
export async function createVehicle(req: Request, res: Response, next: NextFunction) {
  try { return sendCreated(res, await service.createVehicle(validate(createVehicleSchema, req.body))); } catch (err) { return next(err); }
}
export async function bulkCreateVehicles(req: Request, res: Response, next: NextFunction) {
  try { return sendCreated(res, await service.bulkCreateVehicles(validate(bulkCreateVehicleSchema, req.body))); } catch (err) { return next(err); }
}
export async function updateVehicle(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.updateVehicle(Number(req.params.id), validate(updateVehicleSchema, req.body))); } catch (err) { return next(err); }
}
export async function deleteVehicle(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteVehicle(Number(req.params.id)); return sendSuccess(res, { message: "Vehicle deleted" }); } catch (err) { return next(err); }
}
export async function getFileNos(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listFileNos()); } catch (err) { return next(err); }
}
export async function renameFileNo(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.renameFileNo(validate(renameFileNoSchema, req.body))); } catch (err) { return next(err); }
}
export async function deleteFileNo(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.deleteFileNo(validate(deleteFileNoSchema, req.body))); } catch (err) { return next(err); }
}

// ── Expenses ───────────────────────────────────────────────────────────────
export async function getExpenses(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listExpenses(Number(req.params.vehicleId))); } catch (err) { return next(err); }
}
export async function addExpense(req: Request, res: Response, next: NextFunction) {
  try { return sendCreated(res, await service.addExpense(Number(req.params.vehicleId), validate(addExpenseSchema, req.body))); } catch (err) { return next(err); }
}
export async function deleteExpense(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteExpense(Number(req.params.vehicleId), Number(req.params.expenseId)); return sendSuccess(res, { message: "Expense deleted" }); } catch (err) { return next(err); }
}

// ── Vehicle Images ─────────────────────────────────────────────────────────
export async function getVehicleImages(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listVehicleImages(Number(req.params.vehicleId))); } catch (err) { return next(err); }
}
export async function uploadVehicleImages(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[];
    console.log(`[upload] vehicleId=${req.params.vehicleId}, files=${files?.length ?? 0}`, files?.map(f => ({ name: f.originalname, size: f.size, path: f.path })));
    if (!files || files.length === 0) return sendSuccess(res, { message: "No files uploaded" });

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      for (const file of files) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // Best-effort cleanup only.
        }
      }
      throw new AppError("Total upload size cannot exceed 60MB for one request", 413);
    }

    const result = await service.addVehicleImages(Number(req.params.vehicleId), files);
    console.log(`[upload] Saved ${result.length} images to DB`);
    return sendCreated(res, result);
  } catch (err) {
    console.error("[upload] Error:", err);
    return next(err);
  }
}
export async function deleteVehicleImage(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteVehicleImage(Number(req.params.vehicleId), Number(req.params.imageId)); return sendSuccess(res, { message: "Image deleted" }); } catch (err) { return next(err); }
}
export async function setPrimaryImage(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.setPrimaryImage(Number(req.params.vehicleId), Number(req.params.imageId))); } catch (err) { return next(err); }
}

// ── Product Images ─────────────────────────────────────────────────────────
export async function getProductImages(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.listProductImages(Number(req.params.productId))); } catch (err) { return next(err); }
}
export async function uploadProductImages(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return sendSuccess(res, { message: "No files uploaded" });

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      files.forEach((file) => { try { fs.unlinkSync(file.path); } catch {} });
      throw AppError.validation(`Total upload size exceeds ${Math.round(MAX_TOTAL_IMAGE_BYTES / (1024 * 1024))}MB`);
    }

    return sendCreated(res, await service.addProductImages(Number(req.params.productId), files));
  } catch (err) { return next(err); }
}
export async function deleteProductImage(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteProductImage(Number(req.params.productId), Number(req.params.imageId)); return sendSuccess(res, { message: "Image deleted" }); } catch (err) { return next(err); }
}
export async function setPrimaryProductImage(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.setPrimaryProductImage(Number(req.params.productId), Number(req.params.imageId))); } catch (err) { return next(err); }
}
