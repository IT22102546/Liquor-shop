"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSupplierSchema = exports.createSupplierSchema = void 0;
const zod_1 = require("zod");
exports.createSupplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Supplier name is required").max(150),
    contactPerson: zod_1.z.string().trim().max(150).optional(),
    telephone: zod_1.z.string().trim().max(50).optional(),
    address: zod_1.z.string().trim().max(500).optional(),
    fax: zod_1.z.string().trim().max(50).optional(),
    email: zod_1.z.string().trim().email("Valid email is required").max(150).optional().or(zod_1.z.literal("")),
    vatRegistrationNo: zod_1.z.string().trim().max(100).optional(),
});
exports.updateSupplierSchema = exports.createSupplierSchema.partial();
