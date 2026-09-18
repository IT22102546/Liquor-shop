-- CreateTable
CREATE TABLE "inventory_brands" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_products" (
    "id" SERIAL NOT NULL,
    "displayId" TEXT NOT NULL,
    "brandId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "supplierId" INTEGER,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "purchasePrice" DOUBLE PRECISION,
    "taxPaid" DOUBLE PRECISION,
    "additionalExpenses" DOUBLE PRECISION,
    "sellingPrice" DOUBLE PRECISION,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_product_images" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_brands_name_key" ON "inventory_brands"("name");
CREATE UNIQUE INDEX "inventory_categories_name_key" ON "inventory_categories"("name");
CREATE UNIQUE INDEX "inventory_products_displayId_key" ON "inventory_products"("displayId");
CREATE INDEX "inventory_products_brandId_idx" ON "inventory_products"("brandId");
CREATE INDEX "inventory_products_categoryId_idx" ON "inventory_products"("categoryId");
CREATE INDEX "inventory_products_supplierId_idx" ON "inventory_products"("supplierId");

-- AddForeignKey
ALTER TABLE "inventory_products"
ADD CONSTRAINT "inventory_products_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "inventory_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_products"
ADD CONSTRAINT "inventory_products_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_products"
ADD CONSTRAINT "inventory_products_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "bike_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_product_images"
ADD CONSTRAINT "inventory_product_images_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "inventory_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
