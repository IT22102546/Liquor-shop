-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "branchId" INTEGER;

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "branchId" INTEGER;

-- AlterTable
ALTER TABLE "pos_admins" ADD COLUMN     "activeBranchId" INTEGER,
ADD COLUMN     "branchId" INTEGER;

-- AlterTable
ALTER TABLE "pos_cash_entries" ADD COLUMN     "branchId" INTEGER;

-- AlterTable
ALTER TABLE "pos_counter_sales" ADD COLUMN     "branchId" INTEGER;


-- AlterTable
ALTER TABLE "pos_returns" ADD COLUMN     "branchId" INTEGER;

-- AlterTable
ALTER TABLE "pos_shifts" ADD COLUMN     "branchId" INTEGER;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "branchId" INTEGER;

-- CreateTable
CREATE TABLE "branches" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_stock" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
    "emptyBottlesOnHand" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grns" (
    "id" SERIAL NOT NULL,
    "grnNo" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "supplierId" INTEGER,
    "supplierName" TEXT NOT NULL,
    "purchaseOrderId" INTEGER,
    "poNumber" TEXT,
    "supplierInvoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "invoiceTotal" DOUBLE PRECISION,
    "notes" TEXT,
    "acceptedUnits" INTEGER NOT NULL DEFAULT 0,
    "rejectedUnits" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shiftId" INTEGER,
    "receivedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grn_items" (
    "id" SERIAL NOT NULL,
    "grnId" INTEGER NOT NULL,
    "productId" INTEGER,
    "description" TEXT NOT NULL,
    "purchaseOrderItemId" INTEGER,
    "orderedQty" INTEGER,
    "deliveredQty" INTEGER NOT NULL,
    "acceptedQty" INTEGER NOT NULL,
    "rejectedQty" INTEGER NOT NULL DEFAULT 0,
    "rejectReason" TEXT,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "grn_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtns" (
    "id" SERIAL NOT NULL,
    "gtnNo" TEXT NOT NULL,
    "fromBranchId" INTEGER NOT NULL,
    "toBranchId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "notes" TEXT,
    "carriedBy" TEXT,
    "sentById" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentShiftId" INTEGER,
    "receivedById" INTEGER,
    "receivedAt" TIMESTAMP(3),
    "receivedShiftId" INTEGER,
    "receiveNote" TEXT,
    "cancelledById" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "gtns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtn_items" (
    "id" SERIAL NOT NULL,
    "gtnId" INTEGER NOT NULL,
    "productId" INTEGER,
    "productName" TEXT NOT NULL,
    "sentQty" INTEGER NOT NULL,
    "receivedQty" INTEGER,
    "damagedQty" INTEGER NOT NULL DEFAULT 0,
    "missingQty" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION,

    CONSTRAINT "gtn_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE INDEX "branch_stock_productId_idx" ON "branch_stock"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_stock_branchId_productId_key" ON "branch_stock"("branchId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "grns_grnNo_key" ON "grns"("grnNo");

-- CreateIndex
CREATE INDEX "grns_branchId_createdAt_idx" ON "grns"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "grns_supplierId_idx" ON "grns"("supplierId");

-- CreateIndex
CREATE INDEX "grns_purchaseOrderId_idx" ON "grns"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "grn_items_grnId_idx" ON "grn_items"("grnId");

-- CreateIndex
CREATE UNIQUE INDEX "gtns_gtnNo_key" ON "gtns"("gtnNo");

-- CreateIndex
CREATE INDEX "gtns_fromBranchId_sentAt_idx" ON "gtns"("fromBranchId", "sentAt");

-- CreateIndex
CREATE INDEX "gtns_toBranchId_status_idx" ON "gtns"("toBranchId", "status");

-- CreateIndex
CREATE INDEX "gtn_items_gtnId_idx" ON "gtn_items"("gtnId");

-- CreateIndex
CREATE INDEX "activity_logs_branchId_idx" ON "activity_logs"("branchId");

-- CreateIndex
CREATE INDEX "inventory_movements_branchId_idx" ON "inventory_movements"("branchId");

-- CreateIndex
CREATE INDEX "pos_cash_entries_branchId_idx" ON "pos_cash_entries"("branchId");

-- CreateIndex
CREATE INDEX "pos_counter_sales_branchId_idx" ON "pos_counter_sales"("branchId");

-- CreateIndex
CREATE INDEX "pos_returns_branchId_idx" ON "pos_returns"("branchId");

-- CreateIndex
CREATE INDEX "pos_shifts_branchId_idx" ON "pos_shifts"("branchId");

-- CreateIndex
CREATE INDEX "purchase_orders_branchId_idx" ON "purchase_orders"("branchId");

-- AddForeignKey
ALTER TABLE "branch_stock" ADD CONSTRAINT "branch_stock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_stock" ADD CONSTRAINT "branch_stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "inventory_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "grns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtns" ADD CONSTRAINT "gtns_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtns" ADD CONSTRAINT "gtns_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtn_items" ADD CONSTRAINT "gtn_items_gtnId_fkey" FOREIGN KEY ("gtnId") REFERENCES "gtns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Existing data goes into the Main branch ──
INSERT INTO "branches" ("code", "name", "isMain", "updatedAt") VALUES ('MAIN', 'Main branch', true, CURRENT_TIMESTAMP);

INSERT INTO "branch_stock" ("branchId", "productId", "quantity", "damagedQuantity", "emptyBottlesOnHand", "updatedAt")
SELECT (SELECT "id" FROM "branches" WHERE "code" = 'MAIN'), "id", "quantity", "damagedQuantity", "emptyBottlesOnHand", CURRENT_TIMESTAMP FROM "inventory_products";

UPDATE "pos_shifts"          SET "branchId" = (SELECT "id" FROM "branches" WHERE "code" = 'MAIN');
UPDATE "pos_counter_sales"   SET "branchId" = (SELECT "id" FROM "branches" WHERE "code" = 'MAIN');
UPDATE "inventory_movements" SET "branchId" = (SELECT "id" FROM "branches" WHERE "code" = 'MAIN');
UPDATE "pos_cash_entries"    SET "branchId" = (SELECT "id" FROM "branches" WHERE "code" = 'MAIN');
UPDATE "pos_returns"         SET "branchId" = (SELECT "id" FROM "branches" WHERE "code" = 'MAIN');
UPDATE "purchase_orders"     SET "branchId" = (SELECT "id" FROM "branches" WHERE "code" = 'MAIN');
-- Cashiers work at the Main branch; everyone else can switch between branches (starting at Main).
UPDATE "pos_admins" SET "branchId" = (SELECT "id" FROM "branches" WHERE "code" = 'MAIN') WHERE "role" = 'CASHIER';
UPDATE "pos_admins" SET "activeBranchId" = (SELECT "id" FROM "branches" WHERE "code" = 'MAIN') WHERE "role" <> 'CASHIER';
