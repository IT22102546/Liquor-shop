CREATE TABLE IF NOT EXISTS "pos_invoice_terms" (
  "id" SERIAL NOT NULL,
  "text" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pos_invoice_terms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pos_invoice_terms_sortOrder_idx" ON "pos_invoice_terms"("sortOrder");
