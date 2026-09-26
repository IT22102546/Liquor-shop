import { z } from "zod";

const requiredTrimmedText = (field: string) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .max(120, `${field} is too long`);

const optionalEmailSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .optional()
  .or(z.literal(""))
  .transform((value) => {
    if (!value || value === "") return undefined;
    return value;
  });

// Optional text: blank input becomes "not provided".
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** Loyalty member: only name and mobile are required. */
export const createPosUserSchema = z.object({
  firstName: requiredTrimmedText("First name"),
  lastName: z.string().trim().max(120).optional().default(""),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^[0-9+\s-]{7,20}$/, "Enter a valid mobile number"),
  nic: optionalText(40),
  email: optionalEmailSchema,
  province: optionalText(120),
  district: optionalText(120),
  address: optionalText(1000),
});

export const updatePosUserSchema = createPosUserSchema.partial();

export const posUserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().trim().optional(),
});

export const createPurchaseSchema = z
  .object({
    purchaseType: z.enum(["INVENTORY", "CUSTOM"]).default("INVENTORY"),
    purchaseMode: z.enum(["SINGLE", "BULK"]).default("SINGLE"),
    invoiceGroupCode: z.string().trim().max(80).optional(),
    inventoryProductId: z
      .number()
      .int()
      .positive("Inventory product is required")
      .optional(),
    customCategory: z.string().trim().max(120).optional(),
    customDescription: z.string().trim().max(500).optional(),
    quantity: z.number().int().min(1).default(1),
    finalSellingPrice: z.number().min(0, "Final selling price must be >= 0"),
    paymentType: z.enum(["DIRECT", "DOWNPAYMENT"]).default("DIRECT"),
    downPaymentAmount: z
      .number()
      .min(0, "Downpayment amount must be >= 0")
      .optional(),
    extraCosts: z
      .array(
        z.object({
          label: z.string().trim().min(1, "Extra cost name is required").max(120),
          amount: z.number().positive("Extra cost amount must be greater than 0"),
        }),
      )
      .max(20, "A maximum of 20 extra costs is allowed")
      .optional()
      .default([]),
    interestRate: z
      .number()
      .min(0, "Interest rate must be >= 0")
      .max(100, "Interest rate must be <= 100")
      .optional(),
    installmentMonths: z
      .number()
      .int()
      .min(1, "Installment months must be at least 1")
      .optional(),
    paymentMethod: z.enum(["CASH", "CHEQUE", "BANK_TRANSFER"]).optional(),
    chequeNo: z.string().trim().max(80).optional(),
    chequeBank: z.string().trim().max(80).optional(),
    chequeDate: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.purchaseType === "INVENTORY" && !data.inventoryProductId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Inventory product is required",
        path: ["inventoryProductId"],
      });
    }
    if (data.purchaseType === "CUSTOM" && !data.customDescription?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Description is required for custom invoices",
        path: ["customDescription"],
      });
    }
  });

export const checkoutSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(999),
        unitPrice: z.number().min(0),
        // Empty bottles handed back for this product; priced server-side from emptyBottlePrice.
        emptiesReturned: z.number().int().min(0).max(999).default(0),
      }),
    )
    .min(1, "Add at least one product")
    .max(100),
  paymentMethod: z.enum(["CASH", "CHEQUE", "BANK_TRANSFER"]).default("CASH"),
  amountReceived: z.number().min(0).optional(),
  /** Loyalty member buying; leave out for a walk-in customer. */
  customerId: z.number().int().positive().optional(),
  /** Bill discount (only when discounts are switched on in Shop Settings). */
  discount: z
    .object({
      type: z.enum(["PERCENT", "AMOUNT"]),
      value: z.number().positive("Discount must be more than 0"),
    })
    .optional(),
  /** Loyalty points to spend, 1 point = Rs. 1 (members only, when redemption is switched on). */
  redeemPoints: z.number().int().min(0).max(10_000_000).optional(),
});

/** Sales bills list (counter sales). */
export const salesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(30),
  search: z.string().trim().max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerId: z.coerce.number().int().positive().optional(),
});

/** Dashboard summary for a date range (inclusive, local dates). */
export const dashboardQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const purchaseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  search: z.string().trim().optional(),
});

export const settlePurchaseSchema = z
  .object({
    amount: z.number().min(0, "Settlement amount must be greater than or equal to 0"),
    settlementMethod: z.enum(["FULL_PAYMENT"]).default("FULL_PAYMENT"),
    installmentId: z.number().int().positive().optional(),
    isPartial: z.boolean().optional(),
    penaltyRate: z.number().min(0).max(100).optional(),
    paymentMethod: z.enum(["CASH", "CHEQUE", "BANK_TRANSFER"]).optional(),
    chequeNo: z.string().trim().max(80).optional(),
    chequeBank: z.string().trim().max(80).optional(),
    chequeDate: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Settlement amount must be greater than 0",
        path: ["amount"],
      });
    }
  });

export const createInvoiceAccountSchema = z.object({
  accountHolder: requiredTrimmedText("Account holder"),
  accountNumber: requiredTrimmedText("Account number"),
  bankName: requiredTrimmedText("Bank name"),
  branchName: z.string().trim().max(120).optional(),
  sortOrder: z.coerce.number().int().min(1).max(9999).optional(),
  isActive: z.coerce.boolean().optional().default(true),
});

export const updateInvoiceAccountSchema = createInvoiceAccountSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const createInvoiceTermSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Term text is required")
    .max(800, "Term text is too long"),
  sortOrder: z.coerce.number().int().min(1).max(9999).optional(),
  isActive: z.coerce.boolean().optional().default(true),
  termType: z.enum(["ADVANCE", "FINAL"]).default("FINAL"),
});

export const updateInvoiceTermSchema = createInvoiceTermSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const updatePurchaseSchema = z
  .object({
    finalSellingPrice: z.number().min(0).optional(),
    downPaymentAmount: z.number().min(0).optional(),
    mobileNumber: z
      .string()
      .trim()
      .min(7, "Mobile number must be at least 7 characters")
      .max(20, "Mobile number is too long")
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type CreatePosUserDto = z.infer<typeof createPosUserSchema>;
export type UpdatePosUserDto = z.infer<typeof updatePosUserSchema>;
export type PosUserQueryDto = z.infer<typeof posUserQuerySchema>;
export type CreatePurchaseDto = z.infer<typeof createPurchaseSchema>;
export type CheckoutSaleDto = z.infer<typeof checkoutSaleSchema>;
export type SalesQueryDto = z.infer<typeof salesQuerySchema>;
export type DashboardQueryDto = z.infer<typeof dashboardQuerySchema>;
export type PurchaseQueryDto = z.infer<typeof purchaseQuerySchema>;
export type SettlePurchaseDto = z.infer<typeof settlePurchaseSchema>;
export type UpdatePurchaseDto = z.infer<typeof updatePurchaseSchema>;
export type GetInstallmentsDto = { purchaseId: number };
export type CreateInvoiceTermDto = z.infer<typeof createInvoiceTermSchema>;
export type UpdateInvoiceTermDto = z.infer<typeof updateInvoiceTermSchema>;
export type CreateInvoiceAccountDto = z.infer<typeof createInvoiceAccountSchema>;
export type UpdateInvoiceAccountDto = z.infer<typeof updateInvoiceAccountSchema>;
