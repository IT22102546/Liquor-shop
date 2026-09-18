-- Create enums for purchase mode and payment tracking
DO $$ BEGIN
  CREATE TYPE "PosPurchaseMode" AS ENUM ('SINGLE', 'BULK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PosPaymentType" AS ENUM ('DIRECT', 'DOWNPAYMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PosSettlementStatus" AS ENUM ('SETTLED', 'TO_SETTLE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add purchase mode and payment columns to customer purchases
ALTER TABLE "pos_customer_purchases"
ADD COLUMN IF NOT EXISTS "purchaseMode" "PosPurchaseMode" NOT NULL DEFAULT 'SINGLE',
ADD COLUMN IF NOT EXISTS "invoiceGroupCode" TEXT,
ADD COLUMN IF NOT EXISTS "paymentType" "PosPaymentType" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN IF NOT EXISTS "downPaymentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "remainingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "settlementStatus" "PosSettlementStatus" NOT NULL DEFAULT 'SETTLED';

CREATE INDEX IF NOT EXISTS "pos_customer_purchases_invoiceGroupCode_idx" ON "pos_customer_purchases"("invoiceGroupCode");
