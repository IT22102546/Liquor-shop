-- Split payments: a bill can be paid partly in cash and partly by card / transfer.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'SPLIT';
ALTER TABLE "pos_counter_sales" ADD COLUMN "cashPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pos_counter_sales" ADD COLUMN "cardPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pos_counter_sales" ADD COLUMN "transferPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
-- Existing bills were paid one way: put the whole total under that way.
UPDATE "pos_counter_sales" SET "cashPaid" = "totalAmount" WHERE "paymentMethod" = 'CASH';
UPDATE "pos_counter_sales" SET "cardPaid" = "totalAmount" WHERE "paymentMethod" = 'CARD';
UPDATE "pos_counter_sales" SET "transferPaid" = "totalAmount" WHERE "paymentMethod" IN ('BANK_TRANSFER', 'CHEQUE');
