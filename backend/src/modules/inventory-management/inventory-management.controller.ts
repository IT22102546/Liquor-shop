import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import { AppError, validate } from "../../common/utils/errors";
import { sendSuccess, sendCreated } from "../../common/utils/response";
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
  restockProductSchema,
  returnEmptiesSchema,
  productQuerySchema,
} from "./dto/product.dto";
import * as service from "./inventory-management.service";

const MAX_TOTAL_IMAGE_BYTES = 60 * 1024 * 1024;

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
  try {
    const result = await service.listProducts(validate(productQuerySchema, req.query));
    const role = (req as unknown as { user?: { role?: string } }).user?.role;
    if (role !== "CASHIER") return sendSuccess(res, result);

    return sendSuccess(res, {
      ...result,
      products: result.products.map((product) => ({
        id: product.id,
        displayId: product.displayId,
        brandId: product.brandId,
        categoryId: product.categoryId,
        name: product.name,
        partNumber: product.partNumber,
        compatibleWith: product.compatibleWith,
        quantity: product.quantity,
        soldQuantity: product.soldQuantity,
        lowStockThreshold: product.lowStockThreshold,
        sellingPrice: product.sellingPrice,
        emptyBottlePrice: product.emptyBottlePrice,
        emptyBottlesOnHand: product.emptyBottlesOnHand,
        description: product.description,
        lastSoldAt: product.lastSoldAt,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        brand: product.brand,
        category: product.category,
        images: product.images,
      })),
    });
  } catch (err) { return next(err); }
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
export async function restockProduct(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.restockProduct(Number(req.params.id), validate(restockProductSchema, req.body))); } catch (err) { return next(err); }
}
export async function returnEmptiesToSupplier(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.returnEmptiesToSupplier(Number(req.params.id), validate(returnEmptiesSchema, req.body))); } catch (err) { return next(err); }
}
export async function recordProductSale(req: Request, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await service.recordProductSale(Number(req.params.id), validate(recordProductSaleSchema, req.body))); } catch (err) { return next(err); }
}
export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try { await service.deleteProduct(Number(req.params.id)); return sendSuccess(res, { message: "Product deleted" }); } catch (err) { return next(err); }
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
