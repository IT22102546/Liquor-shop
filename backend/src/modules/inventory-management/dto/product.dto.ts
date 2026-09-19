import { z } from "zod";

export const createProductBrandSchema = z.object({
  name: z.string().min(1, "Brand name is required").max(100),
});
export const updateProductBrandSchema = createProductBrandSchema.partial();

export const createProductCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
});
export const updateProductCategorySchema =
  createProductCategorySchema.partial();

const productExpenseSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Expense description is required")
    .max(300),
  amount: z.number().min(0),
});

export const createProductSchema = z.object({
  brandId: z.number().int().positive("Brand is required"),
  categoryId: z.number().int().positive("Category is required"),
  supplierId: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "Product name is required").max(160),
  partNumber: z.string().trim().max(100).optional(),
  compatibleWith: z.string().trim().max(500).optional(),
  quantity: z.number().int().min(0).default(0),
  lowStockThreshold: z
    .union([z.number().int().min(0).max(999), z.null()])
    .optional(),
  purchasePrice: z.number().min(0).optional(),
  taxPaid: z.number().min(0).optional(),
  additionalExpenses: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  description: z.string().trim().max(3000).optional(),
  descriptionPoints: z
    .array(z.string().trim().min(1).max(500))
    .max(50)
    .optional(),
  expenses: z.array(productExpenseSchema).max(100).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  supplierId: z.union([z.number().int().positive(), z.null()]).optional(),
});

export const recordProductSaleSchema = z.object({
  quantity: z.number().int().min(1, "Sold quantity must be at least 1"),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(100),
  brandId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  soldOnly: z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes"].includes(normalized)) return true;
      if (["false", "0", "no"].includes(normalized)) return false;
    }
    return value;
  }, z.boolean().optional()),
  search: z.string().optional(),
});

export type CreateProductBrandDto = z.infer<typeof createProductBrandSchema>;
export type UpdateProductBrandDto = z.infer<typeof updateProductBrandSchema>;
export type CreateProductCategoryDto = z.infer<
  typeof createProductCategorySchema
>;
export type UpdateProductCategoryDto = z.infer<
  typeof updateProductCategorySchema
>;
export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type RecordProductSaleDto = z.infer<typeof recordProductSaleSchema>;
export type ProductQueryDto = z.infer<typeof productQuerySchema>;
