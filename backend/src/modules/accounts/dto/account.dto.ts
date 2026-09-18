import { z } from "zod";

const requiredPositiveInt = (message: string) => z.coerce.number().int().positive(message);
const optionalPositiveInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().positive().optional()
);
const requiredPositiveNumber = (message: string) => z.coerce.number().positive(message);
const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z
    .string()
    .transform((v, ctx) => {
      const date = new Date(v);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: "custom", message: "Invalid date" });
        return z.NEVER;
      }
      return date;
    })
    .optional()
);

const accountTypeValues = ["BANK", "CASH"] as const;
const accountLevelValues = ["MAIN", "SUB"] as const;
const paymentMethodValues = ["CASH", "CHEQUE", "BANK_TRANSFER"] as const;
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
] as const;

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  type: z.enum(accountTypeValues).default("BANK"),
  level: z.enum(accountLevelValues).default("MAIN"),
  mainAccountIds: z.array(z.number().int().positive()).default([]),
  openingBalance: z.number().default(0),
}).superRefine((data, ctx) => {
  if (data.level === "MAIN" && data.mainAccountIds.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["mainAccountIds"],
      message: "Main accounts cannot be linked beneath other main accounts",
    });
  }
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long").optional(),
  type: z.enum(accountTypeValues).optional(),
  level: z.enum(accountLevelValues).optional(),
  mainAccountIds: z.array(z.number().int().positive()).optional(),
  openingBalance: z.number().optional(),
});

export const createReceiptSchema = z.object({
  purchaseId: z.number().int().positive("Purchase is required"),
  accountId: z.number().int().positive("Account is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(paymentMethodValues).default("CASH"),
  chequeNo: z.string().trim().max(80).optional(),
  chequeBank: z.string().trim().max(120).optional(),
  chequeDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  description: z.string().trim().max(500).optional(),
});

export const updateReceiptSchema = createReceiptSchema
  .omit({ purchaseId: true })
  .partial();

export const createVoucherSchema = z
  .object({
    accountId: requiredPositiveInt("Account is required"),
    toAccountId: optionalPositiveInt,
    type: z.enum(voucherTypeValues),
    amount: requiredPositiveNumber("Amount must be greater than 0"),
    description: z.string().trim().max(500).optional(),
    payee: z.string().trim().max(200).optional(),
    paymentDate: optionalDate,
    referenceNo: z.string().trim().max(100).optional(),
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

export const updateVoucherSchema = z
  .object({
    type: z.enum(voucherTypeValues).optional(),
    amount: requiredPositiveNumber("Amount must be greater than 0").optional(),
    description: z.string().trim().max(500).optional(),
    payee: z.string().trim().max(200).optional(),
    paymentDate: optionalDate,
    referenceNo: z.string().trim().max(100).optional(),
  });

export const receiptQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
  accountId: z.coerce.number().int().positive().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const invoiceQueueQuerySchema = z.object({
  search: z.string().trim().optional(),
  showAll: z
    .preprocess((v) => v === "true" || v === "1", z.boolean())
    .default(false),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const invoicePaymentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const generateReceiptFromPaymentSchema = z.object({
  description: z.string().trim().max(500).optional(),
});

export const createDepositSchema = z.object({
  accountId: z.number().int().positive("Account is required"),
  subAccountId: z.number().int().positive().optional(),
  receiptIds: z.array(z.number().int().positive()).min(1, "Select at least one receipt"),
  notes: z.string().trim().max(500).optional(),
});

export const depositQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  accountId: z.coerce.number().int().positive().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const voucherQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(200).optional(),
  type: z.enum(voucherTypeValues).optional(),
  accountId: z.coerce.number().int().positive().optional(),
});

export const ledgerQuerySchema = z.object({
  accountId: z.coerce.number().int().positive("Account is required"),
  from: z.string().min(1, "From date is required"),
  to: z.string().min(1, "To date is required"),
});

export type CreateAccountDto = z.infer<typeof createAccountSchema>;
export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
export type CreateReceiptDto = z.infer<typeof createReceiptSchema>;
export type UpdateReceiptDto = z.infer<typeof updateReceiptSchema>;
export type CreateVoucherDto = z.infer<typeof createVoucherSchema>;
export type UpdateVoucherDto = z.infer<typeof updateVoucherSchema>;
export type ReceiptQueryDto = z.infer<typeof receiptQuerySchema>;
export type InvoiceQueueQueryDto = z.infer<typeof invoiceQueueQuerySchema>;
export type InvoicePaymentQueryDto = z.infer<typeof invoicePaymentQuerySchema>;
export type GenerateReceiptFromPaymentDto = z.infer<typeof generateReceiptFromPaymentSchema>;
export type CreateDepositDto = z.infer<typeof createDepositSchema>;
export type DepositQueryDto = z.infer<typeof depositQuerySchema>;
export type VoucherQueryDto = z.infer<typeof voucherQuerySchema>;
export type LedgerQueryDto = z.infer<typeof ledgerQuerySchema>;
