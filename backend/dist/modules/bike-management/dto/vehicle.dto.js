"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpenseSchema = exports.addExpenseSchema = exports.deleteFileNoSchema = exports.renameFileNoSchema = exports.vehicleQuerySchema = exports.updateVehicleSchema = exports.bulkCreateVehicleSchema = exports.createVehicleSchema = void 0;
const zod_1 = require("zod");
const STATUSES = ["available", "sold"];
const CONDITIONS = ["brandnew", "used"];
const REGISTRATION_TYPES = ["registered", "unregistered"];
const expenseItemSchema = zod_1.z.object({
    description: zod_1.z.string().min(1, "Expense description is required"),
    amount: zod_1.z.number().min(0, "Amount must be >= 0"),
});
exports.createVehicleSchema = zod_1.z.object({
    brandId: zod_1.z.number().int().positive("Brand is required"),
    modelId: zod_1.z.number().int().positive("Model is required"),
    supplierId: zod_1.z.number().int().positive().optional(),
    colour: zod_1.z.string().min(1, "Colour is required"),
    engineCapacityCc: zod_1.z.number().int().min(1, "Engine capacity must be at least 1cc").optional(),
    condition: zod_1.z.enum(CONDITIONS).default("brandnew"),
    mileage: zod_1.z.number().int().min(0).default(0),
    description: zod_1.z.string().trim().max(2000).optional(),
    year: zod_1.z.number().int().min(1900).max(new Date().getFullYear() + 2).optional(),
    fileNo: zod_1.z.string().optional(),
    manufactureDate: zod_1.z.string().optional(),
    registerNo: zod_1.z.string().optional(),
    chassisNo: zod_1.z.string().optional(),
    engineNo: zod_1.z.string().optional(),
    registrationType: zod_1.z.enum(REGISTRATION_TYPES).default("unregistered"),
    purchasePrice: zod_1.z.number().min(0).optional(),
    taxAmount: zod_1.z.number().min(0).optional(),
    sellingPrice: zod_1.z.number().min(0).optional(),
    expenses: zod_1.z.array(expenseItemSchema).optional(),
    status: zod_1.z.enum(STATUSES).default("available"),
});
exports.bulkCreateVehicleSchema = zod_1.z.object({
    brandId: zod_1.z.number().int().positive(),
    modelId: zod_1.z.number().int().positive(),
    supplierId: zod_1.z.number().int().positive().optional(),
    colour: zod_1.z.string().min(1),
    engineCapacityCc: zod_1.z.number().int().min(1, "Engine capacity must be at least 1cc").optional(),
    condition: zod_1.z.enum(CONDITIONS).default("brandnew"),
    mileage: zod_1.z.number().int().min(0).default(0),
    year: zod_1.z.number().int().min(1900).max(new Date().getFullYear() + 2).optional(),
    registrationType: zod_1.z.enum(REGISTRATION_TYPES).default("unregistered"),
    purchasePrice: zod_1.z.number().min(0).optional(),
    taxAmount: zod_1.z.number().min(0).optional(),
    sellingPrice: zod_1.z.number().min(0).optional(),
    expenses: zod_1.z.array(expenseItemSchema).optional(),
    count: zod_1.z.number().int().min(1).max(500),
});
exports.updateVehicleSchema = exports.createVehicleSchema.partial().extend({
    supplierId: zod_1.z.union([zod_1.z.number().int().positive(), zod_1.z.null()]).optional(),
    status: zod_1.z.enum(STATUSES).optional(),
});
exports.vehicleQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(5000).default(50),
    brandId: zod_1.z.coerce.number().int().positive().optional(),
    modelId: zod_1.z.coerce.number().int().positive().optional(),
    colour: zod_1.z.string().optional(),
    year: zod_1.z.coerce.number().int().min(1900).max(new Date().getFullYear() + 2).optional(),
    fileNo: zod_1.z.string().optional(),
    registerNo: zod_1.z.string().optional(),
    chassisNo: zod_1.z.string().optional(),
    status: zod_1.z.enum(STATUSES).optional(),
    search: zod_1.z.string().optional(),
});
exports.renameFileNoSchema = zod_1.z.object({
    oldFileNo: zod_1.z.string().min(1, "Old file number is required"),
    newFileNo: zod_1.z.string().min(1, "New file number is required"),
});
exports.deleteFileNoSchema = zod_1.z.object({
    fileNo: zod_1.z.string().min(1, "File number is required"),
});
exports.addExpenseSchema = zod_1.z.object({
    description: zod_1.z.string().min(1, "Expense description is required"),
    amount: zod_1.z.number().min(0, "Amount must be >= 0"),
});
exports.deleteExpenseSchema = zod_1.z.object({
    expenseId: zod_1.z.number().int().positive(),
});
