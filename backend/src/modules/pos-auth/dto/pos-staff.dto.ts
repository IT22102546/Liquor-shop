import { z } from "zod";

export const posStaffRoleSchema = z.enum([
  "ADMIN",
  "CASHIER",
  "INVENTORY_MANAGER",
  "ACCOUNTANT",
]);

export const createPosStaffSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(100),
  role: posStaffRoleSchema,
});

export const updatePosStaffSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  password: z.string().min(8).max(100).optional(),
  role: posStaffRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

export type CreatePosStaffDto = z.infer<typeof createPosStaffSchema>;
export type UpdatePosStaffDto = z.infer<typeof updatePosStaffSchema>;
