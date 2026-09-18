import { z } from "zod";

const STATUSES = ["available", "sold"] as const;
const CONDITIONS = ["brandnew", "used"] as const;
const REGISTRATION_TYPES = ["registered", "unregistered"] as const;

const expenseItemSchema = z.object({
  description: z.string().min(1, "Expense description is required"),
  amount:      z.number().min(0, "Amount must be >= 0"),
});

export const createVehicleSchema = z.object({
  brandId:          z.number().int().positive("Brand is required"),
  modelId:          z.number().int().positive("Model is required"),
  supplierId:       z.number().int().positive().optional(),
  colour:           z.string().min(1, "Colour is required"),
  engineCapacityCc: z.number().int().min(1, "Engine capacity must be at least 1cc").optional(),
  condition:        z.enum(CONDITIONS).default("brandnew"),
  mileage:          z.number().int().min(0).default(0),
  description:      z.string().trim().max(2000).optional(),
  year:             z.number().int().min(1900).max(new Date().getFullYear() + 2).optional(),
  fileNo:           z.string().optional(),
  manufactureDate:  z.string().optional(),
  registerNo:       z.string().optional(),
  chassisNo:        z.string().optional(),
  engineNo:         z.string().optional(),
  registrationType: z.enum(REGISTRATION_TYPES).default("unregistered"),
  purchasePrice:    z.number().min(0).optional(),
  taxAmount:        z.number().min(0).optional(),
  sellingPrice:     z.number().min(0).optional(),
  expenses:         z.array(expenseItemSchema).optional(),
  status:           z.enum(STATUSES).default("available"),
});

export const bulkCreateVehicleSchema = z.object({
  brandId:          z.number().int().positive(),
  modelId:          z.number().int().positive(),
  supplierId:       z.number().int().positive().optional(),
  colour:           z.string().min(1),
  engineCapacityCc: z.number().int().min(1, "Engine capacity must be at least 1cc").optional(),
  condition:        z.enum(CONDITIONS).default("brandnew"),
  mileage:          z.number().int().min(0).default(0),
  year:             z.number().int().min(1900).max(new Date().getFullYear() + 2).optional(),
  registrationType: z.enum(REGISTRATION_TYPES).default("unregistered"),
  purchasePrice:    z.number().min(0).optional(),
  taxAmount:        z.number().min(0).optional(),
  sellingPrice:     z.number().min(0).optional(),
  expenses:         z.array(expenseItemSchema).optional(),
  count:            z.number().int().min(1).max(500),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  supplierId: z.union([z.number().int().positive(), z.null()]).optional(),
  status: z.enum(STATUSES).optional(),
});

export const vehicleQuerySchema = z.object({
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(5000).default(50),
  brandId: z.coerce.number().int().positive().optional(),
  modelId: z.coerce.number().int().positive().optional(),
  colour: z.string().optional(),
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 2).optional(),
  fileNo: z.string().optional(),
  registerNo: z.string().optional(),
  chassisNo: z.string().optional(),
  status:  z.enum(STATUSES).optional(),
  search:  z.string().optional(),
});

export const renameFileNoSchema = z.object({
  oldFileNo: z.string().min(1, "Old file number is required"),
  newFileNo: z.string().min(1, "New file number is required"),
});

export const deleteFileNoSchema = z.object({
  fileNo: z.string().min(1, "File number is required"),
});

export const addExpenseSchema = z.object({
  description: z.string().min(1, "Expense description is required"),
  amount:      z.number().min(0, "Amount must be >= 0"),
});

export const deleteExpenseSchema = z.object({
  expenseId: z.number().int().positive(),
});

export type CreateVehicleDto     = z.infer<typeof createVehicleSchema>;
export type BulkCreateVehicleDto = z.infer<typeof bulkCreateVehicleSchema>;
export type UpdateVehicleDto     = z.infer<typeof updateVehicleSchema>;
export type VehicleQueryDto      = z.infer<typeof vehicleQuerySchema>;
export type RenameFileNoDto      = z.infer<typeof renameFileNoSchema>;
export type DeleteFileNoDto      = z.infer<typeof deleteFileNoSchema>;
export type AddExpenseDto        = z.infer<typeof addExpenseSchema>;
export type DeleteExpenseDto     = z.infer<typeof deleteExpenseSchema>;
