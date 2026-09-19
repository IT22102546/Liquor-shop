"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bikeQuerySchema = exports.updateBikeSchema = exports.createBikeSchema = void 0;
const zod_1 = require("zod");
exports.createBikeSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Bike name is required"),
    brand: zod_1.z.string().min(1, "Brand is required"),
    model: zod_1.z.string().optional(),
    year: zod_1.z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
    price: zod_1.z.number().nonnegative("Price must be >= 0"),
    inStock: zod_1.z.boolean().default(true),
});
exports.updateBikeSchema = exports.createBikeSchema.partial();
exports.bikeQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    brand: zod_1.z.string().optional(),
    inStock: zod_1.z.enum(["true", "false"]).optional(),
});
