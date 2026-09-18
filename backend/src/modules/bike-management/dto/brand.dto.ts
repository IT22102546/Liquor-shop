import { z } from "zod";

// ── Brands ────────────────────────────────────────────────────────────────────
export const createBrandSchema = z.object({
  name: z.string().min(1, "Brand name is required").max(100),
});
export const updateBrandSchema = createBrandSchema.partial();

// ── Models ────────────────────────────────────────────────────────────────────
export const createModelSchema = z.object({
  name: z.string().min(1, "Model name is required").max(100),
  lowStockThreshold: z.number().int().min(0).max(999).optional(),
});
export const updateModelSchema = createModelSchema.partial().extend({
  lowStockThreshold: z.union([z.number().int().min(0).max(999), z.null()]).optional(),
});

// ── Colors ────────────────────────────────────────────────────────────────────
export const createColorSchema = z.object({
  name: z.string().min(1, "Color name is required").max(60),
});
export const updateColorSchema = createColorSchema.partial();

export type CreateBrandDto = z.infer<typeof createBrandSchema>;
export type UpdateBrandDto = z.infer<typeof updateBrandSchema>;
export type CreateModelDto = z.infer<typeof createModelSchema>;
export type UpdateModelDto = z.infer<typeof updateModelSchema>;
export type CreateColorDto = z.infer<typeof createColorSchema>;
export type UpdateColorDto = z.infer<typeof updateColorSchema>;
