ALTER TABLE "pos_customer_purchases" ADD COLUMN "isHardLiquor" BOOLEAN NOT NULL DEFAULT false;

-- Past bill lines: as the product is marked now (the closest record there is).
UPDATE "pos_customer_purchases" l SET "isHardLiquor" = p."isHardLiquor"
FROM "inventory_products" p WHERE p."id" = l."inventoryProductId";
