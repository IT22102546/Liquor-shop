-- Liquor-shop customers are loyalty members: only name + mobile are required.
ALTER TABLE "pos_customers" ALTER COLUMN "nic" DROP NOT NULL;
ALTER TABLE "pos_customers" ALTER COLUMN "province" DROP NOT NULL;
ALTER TABLE "pos_customers" ALTER COLUMN "district" DROP NOT NULL;
ALTER TABLE "pos_customers" ALTER COLUMN "address" DROP NOT NULL;
ALTER TABLE "pos_customers" ADD COLUMN "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pos_customers" ADD COLUMN "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pos_customers" ADD COLUMN "visits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pos_customers" ADD COLUMN "lastVisitAt" TIMESTAMP(3);

-- Counter sales can be linked to a loyalty member (null = walk-in).
ALTER TABLE "pos_counter_sales" ADD COLUMN "customerId" INTEGER;
ALTER TABLE "pos_counter_sales" ADD COLUMN "pointsEarned" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "pos_counter_sales_customerId_idx" ON "pos_counter_sales"("customerId");
ALTER TABLE "pos_counter_sales" ADD CONSTRAINT "pos_counter_sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "pos_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
