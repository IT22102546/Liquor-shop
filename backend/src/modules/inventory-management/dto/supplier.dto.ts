import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required").max(150),
  contactPerson: z.string().trim().max(150).optional(),
  telephone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
  fax: z.string().trim().max(50).optional(),
  email: z.string().trim().email("Valid email is required").max(150).optional().or(z.literal("")),
  vatRegistrationNo: z.string().trim().max(100).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;
