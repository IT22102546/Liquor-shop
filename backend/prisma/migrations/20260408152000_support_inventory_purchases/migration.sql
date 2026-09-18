-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PosPurchaseItemType" AS ENUM ('BIKE', 'INVENTORY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "pos_customer_purchases"
ADD COLUMN IF NOT EXISTS "itemType" "PosPurchaseItemType" NOT NULL DEFAULT 'BIKE',
ADD COLUMN IF NOT EXISTS "inventoryProductId" INTEGER,
ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "pos_customer_purchases"
ALTER COLUMN "bikeVehicleId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_customer_purchases_inventoryProductId_idx" ON "pos_customer_purchases"("inventoryProductId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pos_customer_purchases"
  ADD CONSTRAINT "pos_customer_purchases_inventoryProductId_fkey"
  FOREIGN KEY ("inventoryProductId") REFERENCES "inventory_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
