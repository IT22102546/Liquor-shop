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
exports.getBrands = getBrands;
exports.createBrand = createBrand;
exports.updateBrand = updateBrand;
exports.deleteBrand = deleteBrand;
exports.getModels = getModels;
exports.getAllModels = getAllModels;
exports.createModel = createModel;
exports.updateModel = updateModel;
exports.deleteModel = deleteModel;
exports.getColors = getColors;
exports.createColor = createColor;
exports.updateColor = updateColor;
exports.deleteColor = deleteColor;
exports.getSuppliers = getSuppliers;
exports.createSupplier = createSupplier;
exports.updateSupplier = updateSupplier;
exports.deleteSupplier = deleteSupplier;
exports.getProductBrands = getProductBrands;
exports.createProductBrand = createProductBrand;
exports.updateProductBrand = updateProductBrand;
exports.deleteProductBrand = deleteProductBrand;
exports.getProductCategories = getProductCategories;
exports.createProductCategory = createProductCategory;
exports.updateProductCategory = updateProductCategory;
exports.deleteProductCategory = deleteProductCategory;
exports.getProducts = getProducts;
exports.getInventoryHealth = getInventoryHealth;
exports.getProduct = getProduct;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.recordProductSale = recordProductSale;
exports.deleteProduct = deleteProduct;
exports.getVehicleSummary = getVehicleSummary;
exports.getVehicles = getVehicles;
exports.getVehicle = getVehicle;
exports.createVehicle = createVehicle;
exports.bulkCreateVehicles = bulkCreateVehicles;
exports.updateVehicle = updateVehicle;
exports.deleteVehicle = deleteVehicle;
exports.getFileNos = getFileNos;
exports.renameFileNo = renameFileNo;
exports.deleteFileNo = deleteFileNo;
exports.getExpenses = getExpenses;
exports.addExpense = addExpense;
exports.deleteExpense = deleteExpense;
exports.getVehicleImages = getVehicleImages;
exports.uploadVehicleImages = uploadVehicleImages;
exports.deleteVehicleImage = deleteVehicleImage;
exports.setPrimaryImage = setPrimaryImage;
exports.getProductImages = getProductImages;
exports.uploadProductImages = uploadProductImages;
exports.deleteProductImage = deleteProductImage;
exports.setPrimaryProductImage = setPrimaryProductImage;
const fs_1 = __importDefault(require("fs"));
const errors_1 = require("../../common/utils/errors");
const response_1 = require("../../common/utils/response");
const brand_dto_1 = require("./dto/brand.dto");
const supplier_dto_1 = require("./dto/supplier.dto");
const product_dto_1 = require("./dto/product.dto");
const vehicle_dto_1 = require("./dto/vehicle.dto");
const service = __importStar(require("./bike-management.service"));
const MAX_TOTAL_IMAGE_BYTES = 60 * 1024 * 1024;
async function getBrands(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listBrands());
    }
    catch (err) {
        return next(err);
    }
}
async function createBrand(req, res, next) {
    try {
        return (0, response_1.sendCreated)(res, await service.createBrand((0, errors_1.validate)(brand_dto_1.createBrandSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function updateBrand(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.updateBrand(Number(req.params.id), (0, errors_1.validate)(brand_dto_1.updateBrandSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function deleteBrand(req, res, next) {
    try {
        await service.deleteBrand(Number(req.params.id));
        return (0, response_1.sendSuccess)(res, { message: "Brand and all related data deleted" });
    }
    catch (err) {
        return next(err);
    }
}
async function getModels(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listModels(Number(req.params.brandId)));
    }
    catch (err) {
        return next(err);
    }
}
async function getAllModels(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listAllModels());
    }
    catch (err) {
        return next(err);
    }
}
async function createModel(req, res, next) {
    try {
        return (0, response_1.sendCreated)(res, await service.createModel(Number(req.params.brandId), (0, errors_1.validate)(brand_dto_1.createModelSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function updateModel(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.updateModel(Number(req.params.id), (0, errors_1.validate)(brand_dto_1.updateModelSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function deleteModel(req, res, next) {
    try {
        await service.deleteModel(Number(req.params.id));
        return (0, response_1.sendSuccess)(res, { message: "Model and all related vehicles deleted" });
    }
    catch (err) {
        return next(err);
    }
}
async function getColors(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listColors());
    }
    catch (err) {
        return next(err);
    }
}
async function createColor(req, res, next) {
    try {
        return (0, response_1.sendCreated)(res, await service.createColor((0, errors_1.validate)(brand_dto_1.createColorSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function updateColor(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.updateColor(Number(req.params.id), (0, errors_1.validate)(brand_dto_1.updateColorSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function deleteColor(req, res, next) {
    try {
        await service.deleteColor(Number(req.params.id));
        return (0, response_1.sendSuccess)(res, { message: "Color deleted" });
    }
    catch (err) {
        return next(err);
    }
}
async function getSuppliers(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listSuppliers());
    }
    catch (err) {
        return next(err);
    }
}
async function createSupplier(req, res, next) {
    try {
        return (0, response_1.sendCreated)(res, await service.createSupplier((0, errors_1.validate)(supplier_dto_1.createSupplierSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function updateSupplier(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.updateSupplier(Number(req.params.id), (0, errors_1.validate)(supplier_dto_1.updateSupplierSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function deleteSupplier(req, res, next) {
    try {
        await service.deleteSupplier(Number(req.params.id));
        return (0, response_1.sendSuccess)(res, { message: "Supplier deleted" });
    }
    catch (err) {
        return next(err);
    }
}
async function getProductBrands(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listProductBrands());
    }
    catch (err) {
        return next(err);
    }
}
async function createProductBrand(req, res, next) {
    try {
        return (0, response_1.sendCreated)(res, await service.createProductBrand((0, errors_1.validate)(product_dto_1.createProductBrandSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function updateProductBrand(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.updateProductBrand(Number(req.params.id), (0, errors_1.validate)(product_dto_1.updateProductBrandSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function deleteProductBrand(req, res, next) {
    try {
        await service.deleteProductBrand(Number(req.params.id));
        return (0, response_1.sendSuccess)(res, { message: "Product brand deleted" });
    }
    catch (err) {
        return next(err);
    }
}
async function getProductCategories(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listProductCategories());
    }
    catch (err) {
        return next(err);
    }
}
async function createProductCategory(req, res, next) {
    try {
        return (0, response_1.sendCreated)(res, await service.createProductCategory((0, errors_1.validate)(product_dto_1.createProductCategorySchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function updateProductCategory(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.updateProductCategory(Number(req.params.id), (0, errors_1.validate)(product_dto_1.updateProductCategorySchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function deleteProductCategory(req, res, next) {
    try {
        await service.deleteProductCategory(Number(req.params.id));
        return (0, response_1.sendSuccess)(res, { message: "Product category deleted" });
    }
    catch (err) {
        return next(err);
    }
}
async function getProducts(req, res, next) {
    try {
        const result = await service.listProducts((0, errors_1.validate)(product_dto_1.productQuerySchema, req.query));
        const role = req.user?.role;
        if (role !== "CASHIER")
            return (0, response_1.sendSuccess)(res, result);
        return (0, response_1.sendSuccess)(res, {
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
                description: product.description,
                lastSoldAt: product.lastSoldAt,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
                brand: product.brand,
                category: product.category,
                images: product.images,
            })),
        });
    }
    catch (err) {
        return next(err);
    }
}
async function getInventoryHealth(_req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.getInventoryHealth());
    }
    catch (err) {
        return next(err);
    }
}
async function getProduct(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.getProduct(Number(req.params.id)));
    }
    catch (err) {
        return next(err);
    }
}
async function createProduct(req, res, next) {
    try {
        return (0, response_1.sendCreated)(res, await service.createProduct((0, errors_1.validate)(product_dto_1.createProductSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function updateProduct(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.updateProduct(Number(req.params.id), (0, errors_1.validate)(product_dto_1.updateProductSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function recordProductSale(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.recordProductSale(Number(req.params.id), (0, errors_1.validate)(product_dto_1.recordProductSaleSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function deleteProduct(req, res, next) {
    try {
        await service.deleteProduct(Number(req.params.id));
        return (0, response_1.sendSuccess)(res, { message: "Product deleted" });
    }
    catch (err) {
        return next(err);
    }
}
async function getVehicleSummary(req, res, next) {
    try {
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        return (0, response_1.sendSuccess)(res, await service.vehicleSummary(status));
    }
    catch (err) {
        return next(err);
    }
}
async function getVehicles(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listVehicles((0, errors_1.validate)(vehicle_dto_1.vehicleQuerySchema, req.query)));
    }
    catch (err) {
        return next(err);
    }
}
async function getVehicle(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.getVehicle(Number(req.params.id)));
    }
    catch (err) {
        return next(err);
    }
}
async function createVehicle(req, res, next) {
    try {
        return (0, response_1.sendCreated)(res, await service.createVehicle((0, errors_1.validate)(vehicle_dto_1.createVehicleSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function bulkCreateVehicles(req, res, next) {
    try {
        return (0, response_1.sendCreated)(res, await service.bulkCreateVehicles((0, errors_1.validate)(vehicle_dto_1.bulkCreateVehicleSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function updateVehicle(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.updateVehicle(Number(req.params.id), (0, errors_1.validate)(vehicle_dto_1.updateVehicleSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function deleteVehicle(req, res, next) {
    try {
        await service.deleteVehicle(Number(req.params.id));
        return (0, response_1.sendSuccess)(res, { message: "Vehicle deleted" });
    }
    catch (err) {
        return next(err);
    }
}
async function getFileNos(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listFileNos());
    }
    catch (err) {
        return next(err);
    }
}
async function renameFileNo(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.renameFileNo((0, errors_1.validate)(vehicle_dto_1.renameFileNoSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function deleteFileNo(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.deleteFileNo((0, errors_1.validate)(vehicle_dto_1.deleteFileNoSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function getExpenses(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listExpenses(Number(req.params.vehicleId)));
    }
    catch (err) {
        return next(err);
    }
}
async function addExpense(req, res, next) {
    try {
        return (0, response_1.sendCreated)(res, await service.addExpense(Number(req.params.vehicleId), (0, errors_1.validate)(vehicle_dto_1.addExpenseSchema, req.body)));
    }
    catch (err) {
        return next(err);
    }
}
async function deleteExpense(req, res, next) {
    try {
        await service.deleteExpense(Number(req.params.vehicleId), Number(req.params.expenseId));
        return (0, response_1.sendSuccess)(res, { message: "Expense deleted" });
    }
    catch (err) {
        return next(err);
    }
}
async function getVehicleImages(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listVehicleImages(Number(req.params.vehicleId)));
    }
    catch (err) {
        return next(err);
    }
}
async function uploadVehicleImages(req, res, next) {
    try {
        const files = req.files;
        console.log(`[upload] vehicleId=${req.params.vehicleId}, files=${files?.length ?? 0}`, files?.map(f => ({ name: f.originalname, size: f.size, path: f.path })));
        if (!files || files.length === 0)
            return (0, response_1.sendSuccess)(res, { message: "No files uploaded" });
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
            for (const file of files) {
                try {
                    fs_1.default.unlinkSync(file.path);
                }
                catch {
                }
            }
            throw new errors_1.AppError("Total upload size cannot exceed 60MB for one request", 413);
        }
        const result = await service.addVehicleImages(Number(req.params.vehicleId), files);
        console.log(`[upload] Saved ${result.length} images to DB`);
        return (0, response_1.sendCreated)(res, result);
    }
    catch (err) {
        console.error("[upload] Error:", err);
        return next(err);
    }
}
async function deleteVehicleImage(req, res, next) {
    try {
        await service.deleteVehicleImage(Number(req.params.vehicleId), Number(req.params.imageId));
        return (0, response_1.sendSuccess)(res, { message: "Image deleted" });
    }
    catch (err) {
        return next(err);
    }
}
async function setPrimaryImage(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.setPrimaryImage(Number(req.params.vehicleId), Number(req.params.imageId)));
    }
    catch (err) {
        return next(err);
    }
}
async function getProductImages(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.listProductImages(Number(req.params.productId)));
    }
    catch (err) {
        return next(err);
    }
}
async function uploadProductImages(req, res, next) {
    try {
        const files = req.files;
        if (!files || files.length === 0)
            return (0, response_1.sendSuccess)(res, { message: "No files uploaded" });
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
            files.forEach((file) => { try {
                fs_1.default.unlinkSync(file.path);
            }
            catch { } });
            throw errors_1.AppError.validation(`Total upload size exceeds ${Math.round(MAX_TOTAL_IMAGE_BYTES / (1024 * 1024))}MB`);
        }
        return (0, response_1.sendCreated)(res, await service.addProductImages(Number(req.params.productId), files));
    }
    catch (err) {
        return next(err);
    }
}
async function deleteProductImage(req, res, next) {
    try {
        await service.deleteProductImage(Number(req.params.productId), Number(req.params.imageId));
        return (0, response_1.sendSuccess)(res, { message: "Image deleted" });
    }
    catch (err) {
        return next(err);
    }
}
async function setPrimaryProductImage(req, res, next) {
    try {
        return (0, response_1.sendSuccess)(res, await service.setPrimaryProductImage(Number(req.params.productId), Number(req.params.imageId)));
    }
    catch (err) {
        return next(err);
    }
}
