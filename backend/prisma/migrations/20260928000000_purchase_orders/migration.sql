CREATE TABLE "purchase_orders" (
    "id" SERIAL NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "notes" TEXT,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentById" INTEGER,
    "receivedAt" TIMESTAMP(3),
    "receivedById" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" INTEGER,
    "cancelReason" TEXT,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "purchase_order_items" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "purchase_order_emails" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "toEmail" TEXT NOT NULL,
    "ccEmail" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "messageId" TEXT,
    "sentById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_emails_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
CREATE INDEX "purchase_order_items_orderId_idx" ON "purchase_order_items"("orderId");
CREATE INDEX "purchase_order_emails_orderId_idx" ON "purchase_order_emails"("orderId");
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "inventory_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_order_emails" ADD CONSTRAINT "purchase_order_emails_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
