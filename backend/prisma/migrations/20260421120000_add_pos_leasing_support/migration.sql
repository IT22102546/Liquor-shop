DO $$ BEGIN
  CREATE TYPE "PosPurchaseChannel" AS ENUM ('PERSONAL', 'LEASING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "pos_leasing_companies" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_leasing_companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_leasing_companies_name_key" ON "pos_leasing_companies"("name");

ALTER TABLE "pos_customer_purchases"
ADD COLUMN IF NOT EXISTS "purchaseChannel" "PosPurchaseChannel" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN IF NOT EXISTS "leasingCompanyId" INTEGER,
ADD COLUMN IF NOT EXISTS "leasingDownPaymentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "leasingFinancedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "pos_customer_purchases_leasingCompanyId_idx"
ON "pos_customer_purchases"("leasingCompanyId");

CREATE INDEX IF NOT EXISTS "pos_customer_purchases_purchaseChannel_idx"
ON "pos_customer_purchases"("purchaseChannel");

DO $$ BEGIN
  ALTER TABLE "pos_customer_purchases"
  ADD CONSTRAINT "pos_customer_purchases_leasingCompanyId_fkey"
  FOREIGN KEY ("leasingCompanyId") REFERENCES "pos_leasing_companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
