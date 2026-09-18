import { z } from "zod";

export const createBikeSchema = z.object({
  name: z.string().min(1, "Bike name is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  price: z.number().nonnegative("Price must be >= 0"),
  inStock: z.boolean().default(true),
});

export const updateBikeSchema = createBikeSchema.partial();

export const bikeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  brand: z.string().optional(),
  inStock: z.enum(["true", "false"]).optional(),
});

export type CreateBikeDto = z.infer<typeof createBikeSchema>;
export type UpdateBikeDto = z.infer<typeof updateBikeSchema>;
export type BikeQueryDto = z.infer<typeof bikeQuerySchema>;
