-- Empty bottle returns: per-product deposit price and collected count,
-- plus per-line and per-sale records of empties handed back at the counter.
ALTER TABLE "inventory_products" ADD COLUMN "emptyBottlePrice" DOUBLE PRECISION;
ALTER TABLE "inventory_products" ADD COLUMN "emptyBottlesOnHand" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "pos_customer_purchases" ADD COLUMN "emptiesReturned" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pos_customer_purchases" ADD COLUMN "emptyDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "pos_counter_sales" ADD COLUMN "emptyDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pos_counter_sales" ADD COLUMN "emptiesReturned" INTEGER NOT NULL DEFAULT 0;
