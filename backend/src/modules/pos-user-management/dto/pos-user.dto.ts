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

export const createPosUserSchema = z.object({
  firstName: requiredTrimmedText("First name"),
  lastName: requiredTrimmedText("Last name"),
  nic: z.string().trim().min(5, "NIC is required").max(40, "NIC is too long"),
  mobileNumber: z
    .string()
    .trim()
    .min(7, "Mobile number is required")
    .max(20, "Mobile number is too long"),
  email: optionalEmailSchema,
  province: requiredTrimmedText("Province"),
  district: requiredTrimmedText("District"),
  address: z
    .string()
    .trim()
    .min(5, "Address is required")
    .max(1000, "Address is too long"),
  dreamBikeIds: z
    .preprocess((value) => {
      if (value == null) return [];
      return value;
    }, z.array(z.number().int().positive()).max(100))
    .optional()
    .default([]),
});

export const updatePosUserSchema = createPosUserSchema.partial();

export const posUserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().trim().optional(),
});

export const createPurchaseSchema = z
  .object({
    purchaseType: z.enum(["BIKE", "INVENTORY", "PRE_ORDER", "CUSTOM"]).default("BIKE"),
    purchaseMode: z.enum(["SINGLE", "BULK"]).default("SINGLE"),
    invoiceGroupCode: z.string().trim().max(80).optional(),
    bikeVehicleId: z.number().int().positive("Bike is required").optional(),
    inventoryProductId: z
      .number()
      .int()
      .positive("Inventory product is required")
      .optional(),
    preOrderId: z.number().int().positive("Pre-order is required").optional(),
    customCategory: z.string().trim().max(120).optional(),
    customDescription: z.string().trim().max(500).optional(),
    quantity: z.number().int().min(1).default(1),
    finalSellingPrice: z.number().min(0, "Final selling price must be >= 0"),
    paymentType: z.enum(["DIRECT", "DOWNPAYMENT"]).default("DIRECT"),
    downPaymentAmount: z
      .number()
      .min(0, "Downpayment amount must be >= 0")
      .optional(),
    purchaseChannel: z.enum(["PERSONAL", "LEASING"]).default("PERSONAL"),
    leasingCompanyId: z
      .number()
      .int()
      .positive("Leasing company is required")
      .optional(),
    leasingDownPaymentAmount: z
      .number()
      .min(0, "Leasing downpayment amount must be >= 0")
      .optional(),
    hasRegistrationFee: z.boolean().optional().default(false),
    registrationFeeAmount: z
      .number()
      .min(0, "Registration fee must be >= 0")
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
    if (data.purchaseType === "BIKE" && !data.bikeVehicleId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bike is required",
        path: ["bikeVehicleId"],
      });
    }
    if (data.purchaseType === "INVENTORY" && !data.inventoryProductId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Inventory product is required",
        path: ["inventoryProductId"],
      });
    }
    if (data.purchaseType === "PRE_ORDER" && !data.preOrderId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pre-order is required",
        path: ["preOrderId"],
      });
    }
    if (data.purchaseType === "CUSTOM" && !data.customDescription?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Description is required for custom invoices",
        path: ["customDescription"],
      });
    }
    if (data.purchaseType === "CUSTOM" && data.purchaseChannel === "LEASING") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Leasing is not available for custom invoices",
        path: ["purchaseChannel"],
      });
    }
    if (
      data.hasRegistrationFee &&
      (!Number.isFinite(data.registrationFeeAmount) ||
        (data.registrationFeeAmount ?? 0) <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Registration fee amount is required when registration is enabled",
        path: ["registrationFeeAmount"],
      });
    }
    if (
      !data.hasRegistrationFee &&
      data.registrationFeeAmount != null &&
      data.registrationFeeAmount > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enable registration fee option first",
        path: ["hasRegistrationFee"],
      });
    }
    if (data.purchaseChannel === "LEASING") {
      if (data.purchaseType !== "BIKE" && data.purchaseType !== "PRE_ORDER") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Leasing is supported only for bike and pre-order purchases",
          path: ["purchaseType"],
        });
      }
      if (!data.leasingCompanyId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Leasing company is required",
          path: ["leasingCompanyId"],
        });
      }
    }
  });

export const createLeasingCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Leasing company name is required")
    .max(120, "Leasing company name is too long"),
});

export const updateLeasingCompanySchema = createLeasingCompanySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const purchaseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  search: z.string().trim().optional(),
});

export const settlePurchaseSchema = z.object({
  amount: z.number().min(0, "Settlement amount must be greater than or equal to 0"),
  settlementMethod: z.enum(["FULL_PAYMENT", "LEASING"]).default("FULL_PAYMENT"),
  leasingSettlementType: z
    .enum(["DOWNPAYMENT_AND_LEASE", "FULL_LEASE"])
    .optional(),
  leasingCompanyId: z.number().int().positive().optional(),
  installmentId: z.number().int().positive().optional(),
  isPartial: z.boolean().optional(),
  penaltyRate: z.number().min(0).max(100).optional(),
  paymentMethod: z.enum(["CASH", "CHEQUE", "BANK_TRANSFER"]).optional(),
  chequeNo: z.string().trim().max(80).optional(),
  chequeBank: z.string().trim().max(80).optional(),
  chequeDate: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.settlementMethod === "FULL_PAYMENT" && data.amount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Settlement amount must be greater than 0",
      path: ["amount"],
    });
  }
  if (data.settlementMethod === "LEASING") {
    if (!data.leasingSettlementType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a leasing settlement option",
        path: ["leasingSettlementType"],
      });
    }
    if (!data.leasingCompanyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Leasing company is required",
        path: ["leasingCompanyId"],
      });
    }
    if (
      data.leasingSettlementType === "DOWNPAYMENT_AND_LEASE" &&
      data.amount <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Additional downpayment must be greater than 0",
        path: ["amount"],
      });
    }
    if (data.leasingSettlementType === "FULL_LEASE" && data.amount !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Customer payment must be 0 for a full lease",
        path: ["amount"],
      });
    }
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
    registrationFeeAmount: z.number().min(0).optional(),
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
export type PurchaseQueryDto = z.infer<typeof purchaseQuerySchema>;
export type SettlePurchaseDto = z.infer<typeof settlePurchaseSchema>;
export type UpdatePurchaseDto = z.infer<typeof updatePurchaseSchema>;
export type GetInstallmentsDto = { purchaseId: number };
export type CreateInvoiceTermDto = z.infer<typeof createInvoiceTermSchema>;
export type UpdateInvoiceTermDto = z.infer<typeof updateInvoiceTermSchema>;
export type CreateInvoiceAccountDto = z.infer<typeof createInvoiceAccountSchema>;
export type UpdateInvoiceAccountDto = z.infer<typeof updateInvoiceAccountSchema>;
export type CreateLeasingCompanyDto = z.infer<
  typeof createLeasingCompanySchema
>;
export type UpdateLeasingCompanyDto = z.infer<
  typeof updateLeasingCompanySchema
>;
