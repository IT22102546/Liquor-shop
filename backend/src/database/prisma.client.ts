import { PrismaClient } from "../generated/prisma";
import { env } from "../config/env";

declare global {
  // Prevent multiple instances in hot-reload dev (tsx watch)
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
