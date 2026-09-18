CREATE TYPE "InvoiceTermType" AS ENUM ('ADVANCE', 'FINAL');

ALTER TABLE "pos_invoice_terms"
ADD COLUMN "termType" "InvoiceTermType" NOT NULL DEFAULT 'FINAL';

CREATE INDEX "pos_invoice_terms_termType_sortOrder_idx"
ON "pos_invoice_terms"("termType", "sortOrder");
