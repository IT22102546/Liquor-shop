-- Book balancing: shifts (till sessions), cash book (receipts/vouchers) and stock movements.
CREATE TABLE "pos_shifts" (
    "id" SERIAL NOT NULL,
    "shiftNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedById" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingFloat" DOUBLE PRECISION NOT NULL,
    "countedCash" DOUBLE PRECISION,
    "denominations" JSONB,
    "countedById" INTEGER,
    "countedAt" TIMESTAMP(3),
    "expectedCash" DOUBLE PRECISION,
    "cashDifference" DOUBLE PRECISION,
    "differenceReason" TEXT,
    "cardSlipTotal" DOUBLE PRECISION,
    "floatLeft" DOUBLE PRECISION,
    "cashBanked" DOUBLE PRECISION,
    "closedById" INTEGER,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "report" JSONB,
    CONSTRAINT "pos_shifts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pos_shifts_shiftNo_key" ON "pos_shifts"("shiftNo");
CREATE INDEX "pos_shifts_status_idx" ON "pos_shifts"("status");
CREATE INDEX "pos_shifts_openedAt_idx" ON "pos_shifts"("openedAt");

CREATE TABLE "pos_cash_entries" (
    "id" SERIAL NOT NULL,
    "entryNo" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "party" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shiftId" INTEGER,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" TEXT,
    "voidedById" INTEGER,
    "voidedAt" TIMESTAMP(3),
    CONSTRAINT "pos_cash_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pos_cash_entries_entryNo_key" ON "pos_cash_entries"("entryNo");
CREATE INDEX "pos_cash_entries_direction_entryDate_idx" ON "pos_cash_entries"("direction", "entryDate");
CREATE INDEX "pos_cash_entries_shiftId_idx" ON "pos_cash_entries"("shiftId");
ALTER TABLE "pos_cash_entries" ADD CONSTRAINT "pos_cash_entries_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "pos_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "inventory_movements" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shiftId" INTEGER,
    "reference" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventory_movements_productId_createdAt_idx" ON "inventory_movements"("productId", "createdAt");
CREATE INDEX "inventory_movements_shiftId_idx" ON "inventory_movements"("shiftId");
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "pos_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sales belong to a shift.
ALTER TABLE "pos_counter_sales" ADD COLUMN "shiftId" INTEGER;
CREATE INDEX "pos_counter_sales_shiftId_idx" ON "pos_counter_sales"("shiftId");
ALTER TABLE "pos_counter_sales" ADD CONSTRAINT "pos_counter_sales_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "pos_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
