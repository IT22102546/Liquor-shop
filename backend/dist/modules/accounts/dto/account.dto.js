"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledgerQuerySchema = exports.voucherQuerySchema = exports.depositQuerySchema = exports.createDepositSchema = exports.generateReceiptFromPaymentSchema = exports.invoicePaymentQuerySchema = exports.invoiceQueueQuerySchema = exports.receiptQuerySchema = exports.updateVoucherSchema = exports.createVoucherSchema = exports.updateReceiptSchema = exports.createReceiptSchema = exports.updateAccountSchema = exports.createAccountSchema = void 0;
const zod_1 = require("zod");
const requiredPositiveInt = (message) => zod_1.z.coerce.number().int().positive(message);
const optionalPositiveInt = zod_1.z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), zod_1.z.coerce.number().int().positive().optional());
const requiredPositiveNumber = (message) => zod_1.z.coerce.number().positive(message);
const optionalDate = zod_1.z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), zod_1.z
    .string()
    .transform((v, ctx) => {
    const date = new Date(v);
    if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: "custom", message: "Invalid date" });
        return zod_1.z.NEVER;
    }
    return date;
})
    .optional());
const accountTypeValues = ["BANK", "CASH"];
const accountLevelValues = ["MAIN", "SUB"];
const paymentMethodValues = ["CASH", "CHEQUE", "BANK_TRANSFER"];
const accountTransferType = "ACCOUNT_TRANSFER";
const voucherTypeValues = [
    "VEHICLE_CLEARANCE",
    "BILL",
    "OTHER_PAYMENT",
    "PERMIT",
    "LEASING_PAYMENT",
    "LOAN_PAYMENT",
    "SALARY",
    "CUSTOMER_REFUND",
    "VEHICLE_PURCHASE",
    "ADVANCE_REFUND",
    accountTransferType,
];
exports.createAccountSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
    type: zod_1.z.enum(accountTypeValues).default("BANK"),
    level: zod_1.z.enum(accountLevelValues).default("MAIN"),
    mainAccountIds: zod_1.z.array(zod_1.z.number().int().positive()).default([]),
    openingBalance: zod_1.z.number().default(0),
}).superRefine((data, ctx) => {
    if (data.level === "MAIN" && data.mainAccountIds.length > 0) {
        ctx.addIssue({
            code: "custom",
            path: ["mainAccountIds"],
            message: "Main accounts cannot be linked beneath other main accounts",
        });
    }
});
exports.updateAccountSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, "Name is required").max(120, "Name is too long").optional(),
    type: zod_1.z.enum(accountTypeValues).optional(),
    level: zod_1.z.enum(accountLevelValues).optional(),
    mainAccountIds: zod_1.z.array(zod_1.z.number().int().positive()).optional(),
    openingBalance: zod_1.z.number().optional(),
});
exports.createReceiptSchema = zod_1.z.object({
    purchaseId: zod_1.z.number().int().positive("Purchase is required"),
    accountId: zod_1.z.number().int().positive("Account is required"),
    amount: zod_1.z.number().positive("Amount must be greater than 0"),
    paymentMethod: zod_1.z.enum(paymentMethodValues).default("CASH"),
    chequeNo: zod_1.z.string().trim().max(80).optional(),
    chequeBank: zod_1.z.string().trim().max(120).optional(),
    chequeDate: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
    description: zod_1.z.string().trim().max(500).optional(),
});
exports.updateReceiptSchema = exports.createReceiptSchema
    .omit({ purchaseId: true })
    .partial();
exports.createVoucherSchema = zod_1.z
    .object({
    accountId: requiredPositiveInt("Account is required"),
    toAccountId: optionalPositiveInt,
    type: zod_1.z.enum(voucherTypeValues),
    amount: requiredPositiveNumber("Amount must be greater than 0"),
    description: zod_1.z.string().trim().max(500).optional(),
    payee: zod_1.z.string().trim().max(200).optional(),
    paymentDate: optionalDate,
    referenceNo: zod_1.z.string().trim().max(100).optional(),
})
    .superRefine((d, ctx) => {
    if (d.type === accountTransferType && !d.toAccountId) {
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Destination account is required for transfers" });
    }
    if (d.toAccountId && d.type !== accountTransferType) {
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "toAccountId is only valid for ACCOUNT_TRANSFER type" });
    }
    if (d.toAccountId && d.toAccountId === d.accountId) {
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Source and destination accounts must be different" });
    }
});
exports.updateVoucherSchema = zod_1.z
    .object({
    type: zod_1.z.enum(voucherTypeValues).optional(),
    amount: requiredPositiveNumber("Amount must be greater than 0").optional(),
    description: zod_1.z.string().trim().max(500).optional(),
    payee: zod_1.z.string().trim().max(200).optional(),
    paymentDate: optionalDate,
    referenceNo: zod_1.z.string().trim().max(100).optional(),
});
exports.receiptQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
    search: zod_1.z.string().trim().optional(),
    accountId: zod_1.z.coerce.number().int().positive().optional(),
    from: zod_1.z.string().trim().optional(),
    to: zod_1.z.string().trim().optional(),
});
exports.invoiceQueueQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().optional(),
    showAll: zod_1.z
        .preprocess((v) => v === "true" || v === "1", zod_1.z.boolean())
        .default(false),
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(500).default(100),
});
exports.invoicePaymentQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
    search: zod_1.z.string().trim().optional(),
    from: zod_1.z.string().trim().optional(),
    to: zod_1.z.string().trim().optional(),
});
exports.generateReceiptFromPaymentSchema = zod_1.z.object({
    description: zod_1.z.string().trim().max(500).optional(),
});
exports.createDepositSchema = zod_1.z.object({
    accountId: zod_1.z.number().int().positive("Account is required"),
    subAccountId: zod_1.z.number().int().positive().optional(),
    receiptIds: zod_1.z.array(zod_1.z.number().int().positive()).min(1, "Select at least one receipt"),
    notes: zod_1.z.string().trim().max(500).optional(),
});
exports.depositQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
    accountId: zod_1.z.coerce.number().int().positive().optional(),
    from: zod_1.z.string().trim().optional(),
    to: zod_1.z.string().trim().optional(),
});
exports.voucherQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
    search: zod_1.z.string().trim().max(200).optional(),
    type: zod_1.z.enum(voucherTypeValues).optional(),
    accountId: zod_1.z.coerce.number().int().positive().optional(),
});
exports.ledgerQuerySchema = zod_1.z.object({
    accountId: zod_1.z.coerce.number().int().positive("Account is required"),
    from: zod_1.z.string().min(1, "From date is required"),
    to: zod_1.z.string().min(1, "To date is required"),
});
