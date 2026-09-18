CREATE TABLE "inventory_product_expenses" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_product_expenses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "inventory_product_expenses"
ADD CONSTRAINT "inventory_product_expenses_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "inventory_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
