import { z } from "zod";

export const posLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type PosLoginDto = z.infer<typeof posLoginSchema>;
