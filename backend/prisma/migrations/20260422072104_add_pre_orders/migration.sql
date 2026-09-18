-- CreateTable
CREATE TABLE "pre_orders" (
    "id" SERIAL NOT NULL,
    "displayId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "cc" TEXT,
    "colour" TEXT,
    "price" DOUBLE PRECISION,
    "depositRequired" TEXT,
    "expectedArrival" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pre-order',
    "description" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pre_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_order_images" (
    "id" SERIAL NOT NULL,
    "preOrderId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_order_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pre_orders_displayId_key" ON "pre_orders"("displayId");

-- CreateIndex
CREATE INDEX "pre_orders_status_idx" ON "pre_orders"("status");

-- CreateIndex
CREATE INDEX "pre_orders_isPublished_idx" ON "pre_orders"("isPublished");

-- AddForeignKey
ALTER TABLE "pre_order_images" ADD CONSTRAINT "pre_order_images_preOrderId_fkey" FOREIGN KEY ("preOrderId") REFERENCES "pre_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
