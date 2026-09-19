"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePurchaseSchema = exports.updateInvoiceTermSchema = exports.createInvoiceTermSchema = exports.updateInvoiceAccountSchema = exports.createInvoiceAccountSchema = exports.settlePurchaseSchema = exports.purchaseQuerySchema = exports.checkoutSaleSchema = exports.createPurchaseSchema = exports.posUserQuerySchema = exports.updatePosUserSchema = exports.createPosUserSchema = void 0;
const zod_1 = require("zod");
const requiredTrimmedText = (field) => zod_1.z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .max(120, `${field} is too long`);
const optionalEmailSchema = zod_1.z
    .string()
    .trim()
    .email("Invalid email address")
    .optional()
    .or(zod_1.z.literal(""))
    .transform((value) => {
    if (!value || value === "")
        return undefined;
    return value;
});
exports.createPosUserSchema = zod_1.z.object({
    firstName: requiredTrimmedText("First name"),
    lastName: requiredTrimmedText("Last name"),
    nic: zod_1.z.string().trim().min(5, "NIC is required").max(40, "NIC is too long"),
    mobileNumber: zod_1.z
        .string()
        .trim()
        .min(7, "Mobile number is required")
        .max(20, "Mobile number is too long"),
    email: optionalEmailSchema,
    province: requiredTrimmedText("Province"),
    district: requiredTrimmedText("District"),
    address: zod_1.z
        .string()
        .trim()
        .min(5, "Address is required")
        .max(1000, "Address is too long"),
});
exports.updatePosUserSchema = exports.createPosUserSchema.partial();
exports.posUserQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(500).default(20),
    search: zod_1.z.string().trim().optional(),
});
exports.createPurchaseSchema = zod_1.z
    .object({
    purchaseType: zod_1.z.enum(["INVENTORY", "CUSTOM"]).default("INVENTORY"),
    purchaseMode: zod_1.z.enum(["SINGLE", "BULK"]).default("SINGLE"),
    invoiceGroupCode: zod_1.z.string().trim().max(80).optional(),
    inventoryProductId: zod_1.z
        .number()
        .int()
        .positive("Inventory product is required")
        .optional(),
    customCategory: zod_1.z.string().trim().max(120).optional(),
    customDescription: zod_1.z.string().trim().max(500).optional(),
    quantity: zod_1.z.number().int().min(1).default(1),
    finalSellingPrice: zod_1.z.number().min(0, "Final selling price must be >= 0"),
    paymentType: zod_1.z.enum(["DIRECT", "DOWNPAYMENT"]).default("DIRECT"),
    downPaymentAmount: zod_1.z
        .number()
        .min(0, "Downpayment amount must be >= 0")
        .optional(),
    extraCosts: zod_1.z
        .array(zod_1.z.object({
        label: zod_1.z.string().trim().min(1, "Extra cost name is required").max(120),
        amount: zod_1.z.number().positive("Extra cost amount must be greater than 0"),
    }))
        .max(20, "A maximum of 20 extra costs is allowed")
        .optional()
        .default([]),
    interestRate: zod_1.z
        .number()
        .min(0, "Interest rate must be >= 0")
        .max(100, "Interest rate must be <= 100")
        .optional(),
    installmentMonths: zod_1.z
        .number()
        .int()
        .min(1, "Installment months must be at least 1")
        .optional(),
    paymentMethod: zod_1.z.enum(["CASH", "CHEQUE", "BANK_TRANSFER"]).optional(),
    chequeNo: zod_1.z.string().trim().max(80).optional(),
    chequeBank: zod_1.z.string().trim().max(80).optional(),
    chequeDate: zod_1.z.string().trim().optional(),
})
    .superRefine((data, ctx) => {
    if (data.purchaseType === "INVENTORY" && !data.inventoryProductId) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Inventory product is required",
            path: ["inventoryProductId"],
        });
    }
    if (data.purchaseType === "CUSTOM" && !data.customDescription?.trim()) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Description is required for custom invoices",
            path: ["customDescription"],
        });
    }
});
exports.checkoutSaleSchema = zod_1.z.object({
    items: zod_1.z
        .array(zod_1.z.object({
        productId: zod_1.z.number().int().positive(),
        quantity: zod_1.z.number().int().min(1).max(999),
        unitPrice: zod_1.z.number().min(0),
    }))
        .min(1, "Add at least one product")
        .max(100),
    paymentMethod: zod_1.z.enum(["CASH", "CHEQUE", "BANK_TRANSFER"]).default("CASH"),
    amountReceived: zod_1.z.number().min(0).optional(),
});
exports.purchaseQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(500).default(50),
    search: zod_1.z.string().trim().optional(),
});
exports.settlePurchaseSchema = zod_1.z
    .object({
    amount: zod_1.z.number().min(0, "Settlement amount must be greater than or equal to 0"),
    settlementMethod: zod_1.z.enum(["FULL_PAYMENT"]).default("FULL_PAYMENT"),
    installmentId: zod_1.z.number().int().positive().optional(),
    isPartial: zod_1.z.boolean().optional(),
    penaltyRate: zod_1.z.number().min(0).max(100).optional(),
    paymentMethod: zod_1.z.enum(["CASH", "CHEQUE", "BANK_TRANSFER"]).optional(),
    chequeNo: zod_1.z.string().trim().max(80).optional(),
    chequeBank: zod_1.z.string().trim().max(80).optional(),
    chequeDate: zod_1.z.string().trim().optional(),
})
    .superRefine((data, ctx) => {
    if (data.amount <= 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Settlement amount must be greater than 0",
            path: ["amount"],
        });
    }
});
exports.createInvoiceAccountSchema = zod_1.z.object({
    accountHolder: requiredTrimmedText("Account holder"),
    accountNumber: requiredTrimmedText("Account number"),
    bankName: requiredTrimmedText("Bank name"),
    branchName: zod_1.z.string().trim().max(120).optional(),
    sortOrder: zod_1.z.coerce.number().int().min(1).max(9999).optional(),
    isActive: zod_1.z.coerce.boolean().optional().default(true),
});
exports.updateInvoiceAccountSchema = exports.createInvoiceAccountSchema
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
});
exports.createInvoiceTermSchema = zod_1.z.object({
    text: zod_1.z
        .string()
        .trim()
        .min(1, "Term text is required")
        .max(800, "Term text is too long"),
    sortOrder: zod_1.z.coerce.number().int().min(1).max(9999).optional(),
    isActive: zod_1.z.coerce.boolean().optional().default(true),
    termType: zod_1.z.enum(["ADVANCE", "FINAL"]).default("FINAL"),
});
exports.updateInvoiceTermSchema = exports.createInvoiceTermSchema
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
});
exports.updatePurchaseSchema = zod_1.z
    .object({
    finalSellingPrice: zod_1.z.number().min(0).optional(),
    downPaymentAmount: zod_1.z.number().min(0).optional(),
    mobileNumber: zod_1.z
        .string()
        .trim()
        .min(7, "Mobile number must be at least 7 characters")
        .max(20, "Mobile number is too long")
        .optional(),
})
    .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
});
