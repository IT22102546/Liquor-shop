"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateColorSchema = exports.createColorSchema = exports.updateModelSchema = exports.createModelSchema = exports.updateBrandSchema = exports.createBrandSchema = void 0;
const zod_1 = require("zod");
exports.createBrandSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Brand name is required").max(100),
});
exports.updateBrandSchema = exports.createBrandSchema.partial();
exports.createModelSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Model name is required").max(100),
    lowStockThreshold: zod_1.z.number().int().min(0).max(999).optional(),
});
exports.updateModelSchema = exports.createModelSchema.partial().extend({
    lowStockThreshold: zod_1.z.union([zod_1.z.number().int().min(0).max(999), zod_1.z.null()]).optional(),
});
exports.createColorSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Color name is required").max(60),
});
exports.updateColorSchema = exports.createColorSchema.partial();
