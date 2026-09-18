import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { prisma } from "./database/prisma.client";
import { ensurePosInvoiceAccountsTable } from "./database/pos-invoice-accounts.bootstrap";
import { env } from "./config/env";

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log("Database connected");

    await ensurePosInvoiceAccountsTable();

    app.listen(env.PORT, () => {
      console.log(`Backend running on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

bootstrap();
