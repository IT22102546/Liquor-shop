"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productQuerySchema = exports.recordProductSaleSchema = exports.updateProductSchema = exports.createProductSchema = exports.updateProductCategorySchema = exports.createProductCategorySchema = exports.updateProductBrandSchema = exports.createProductBrandSchema = void 0;
const zod_1 = require("zod");
exports.createProductBrandSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Brand name is required").max(100),
});
exports.updateProductBrandSchema = exports.createProductBrandSchema.partial();
exports.createProductCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Category name is required").max(100),
});
exports.updateProductCategorySchema = exports.createProductCategorySchema.partial();
const productExpenseSchema = zod_1.z.object({
    description: zod_1.z
        .string()
        .trim()
        .min(1, "Expense description is required")
        .max(300),
    amount: zod_1.z.number().min(0),
});
exports.createProductSchema = zod_1.z.object({
    brandId: zod_1.z.number().int().positive("Brand is required"),
    categoryId: zod_1.z.number().int().positive("Category is required"),
    supplierId: zod_1.z.number().int().positive().optional(),
    name: zod_1.z.string().trim().min(1, "Product name is required").max(160),
    partNumber: zod_1.z.string().trim().max(100).optional(),
    compatibleWith: zod_1.z.string().trim().max(500).optional(),
    quantity: zod_1.z.number().int().min(0).default(0),
    lowStockThreshold: zod_1.z
        .union([zod_1.z.number().int().min(0).max(999), zod_1.z.null()])
        .optional(),
    purchasePrice: zod_1.z.number().min(0).optional(),
    taxPaid: zod_1.z.number().min(0).optional(),
    additionalExpenses: zod_1.z.number().min(0).optional(),
    sellingPrice: zod_1.z.number().min(0).optional(),
    description: zod_1.z.string().trim().max(3000).optional(),
    descriptionPoints: zod_1.z
        .array(zod_1.z.string().trim().min(1).max(500))
        .max(50)
        .optional(),
    expenses: zod_1.z.array(productExpenseSchema).max(100).optional(),
});
exports.updateProductSchema = exports.createProductSchema.partial().extend({
    supplierId: zod_1.z.union([zod_1.z.number().int().positive(), zod_1.z.null()]).optional(),
});
exports.recordProductSaleSchema = zod_1.z.object({
    quantity: zod_1.z.number().int().min(1, "Sold quantity must be at least 1"),
});
exports.productQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(5000).default(100),
    brandId: zod_1.z.coerce.number().int().positive().optional(),
    categoryId: zod_1.z.coerce.number().int().positive().optional(),
    supplierId: zod_1.z.coerce.number().int().positive().optional(),
    soldOnly: zod_1.z.preprocess((value) => {
        if (value === undefined)
            return undefined;
        if (typeof value === "string") {
            const normalized = value.trim().toLowerCase();
            if (["true", "1", "yes"].includes(normalized))
                return true;
            if (["false", "0", "no"].includes(normalized))
                return false;
        }
        return value;
    }, zod_1.z.boolean().optional()),
    search: zod_1.z.string().optional(),
});
