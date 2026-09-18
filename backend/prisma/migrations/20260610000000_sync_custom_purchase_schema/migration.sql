DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PosPurchaseItemType') THEN
    CREATE TYPE "PosPurchaseItemType" AS ENUM ('BIKE', 'INVENTORY', 'PRE_ORDER', 'CUSTOM');
  END IF;
END $$;

ALTER TYPE "PosPurchaseItemType" ADD VALUE IF NOT EXISTS 'PRE_ORDER';
ALTER TYPE "PosPurchaseItemType" ADD VALUE IF NOT EXISTS 'CUSTOM';

ALTER TABLE "pos_customer_purchases"
ADD COLUMN IF NOT EXISTS "preOrderId" INTEGER,
ADD COLUMN IF NOT EXISTS "customCategory" TEXT,
ADD COLUMN IF NOT EXISTS "customDescription" TEXT;

CREATE INDEX IF NOT EXISTS "pos_customer_purchases_preOrderId_idx"
ON "pos_customer_purchases"("preOrderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pos_customer_purchases_preOrderId_fkey'
  ) THEN
    ALTER TABLE "pos_customer_purchases"
      ADD CONSTRAINT "pos_customer_purchases_preOrderId_fkey"
      FOREIGN KEY ("preOrderId") REFERENCES "pre_orders"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
