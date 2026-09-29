ALTER TABLE "inventory_products" ADD COLUMN "damagedQuantity" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "pos_returns" (
    "id" SERIAL NOT NULL,
    "returnNo" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "productId" INTEGER,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" TEXT,
    "invoiceGroupCode" TEXT,
    "customerId" INTEGER,
    "customerName" TEXT,
    "customerMobile" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundMethod" TEXT,
    "pointsReversed" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "disposal" TEXT,
    "reference" TEXT,
    "shiftId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_returns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_returns_returnNo_idx" ON "pos_returns"("returnNo");
CREATE INDEX "pos_returns_type_createdAt_idx" ON "pos_returns"("type", "createdAt");
CREATE INDEX "pos_returns_shiftId_idx" ON "pos_returns"("shiftId");
CREATE INDEX "pos_returns_invoiceGroupCode_idx" ON "pos_returns"("invoiceGroupCode");
CREATE INDEX "pos_returns_productId_idx" ON "pos_returns"("productId");
CREATE INDEX "pos_returns_customerId_idx" ON "pos_returns"("customerId");

ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_productId_fkey" FOREIGN KEY ("productId") REFERENCES "inventory_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "pos_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "pos_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
