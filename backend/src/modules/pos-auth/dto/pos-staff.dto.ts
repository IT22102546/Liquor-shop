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
  /** Branch they work at (required for cashiers); null = can switch between branches. */
  branchId: z.number().int().positive().nullable().optional(),
});

export const updatePosStaffSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  password: z.string().min(8).max(100).optional(),
  role: posStaffRoleSchema.optional(),
  isActive: z.boolean().optional(),
  branchId: z.number().int().positive().nullable().optional(),
});

export type CreatePosStaffDto = z.infer<typeof createPosStaffSchema>;
export type UpdatePosStaffDto = z.infer<typeof updatePosStaffSchema>;
