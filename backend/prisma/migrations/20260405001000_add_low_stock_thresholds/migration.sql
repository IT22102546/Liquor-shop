ALTER TABLE "bike_models"
ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "inventory_products"
ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;
