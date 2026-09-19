"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePosStaffSchema = exports.createPosStaffSchema = exports.posStaffRoleSchema = void 0;
const zod_1 = require("zod");
exports.posStaffRoleSchema = zod_1.z.enum([
    "ADMIN",
    "CASHIER",
    "INVENTORY_MANAGER",
    "ACCOUNTANT",
]);
exports.createPosStaffSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(100),
    email: zod_1.z.string().trim().email().transform((value) => value.toLowerCase()),
    password: zod_1.z.string().min(8).max(100),
    role: exports.posStaffRoleSchema,
});
exports.updatePosStaffSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(100).optional(),
    email: zod_1.z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
    password: zod_1.z.string().min(8).max(100).optional(),
    role: exports.posStaffRoleSchema.optional(),
    isActive: zod_1.z.boolean().optional(),
});
