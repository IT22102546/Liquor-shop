ALTER TABLE "bike_models"
ALTER COLUMN "lowStockThreshold" DROP NOT NULL,
ALTER COLUMN "lowStockThreshold" DROP DEFAULT;

ALTER TABLE "inventory_products"
ALTER COLUMN "lowStockThreshold" DROP NOT NULL,
ALTER COLUMN "lowStockThreshold" DROP DEFAULT;
