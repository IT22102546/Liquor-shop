-- Customer wallet: change kept at the shop, spent on later bills.
ALTER TABLE "pos_customers" ADD COLUMN "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pos_counter_sales" ADD COLUMN "walletUsed" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pos_counter_sales" ADD COLUMN "walletCredit" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE TABLE "pos_wallet_transactions" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "invoiceGroupCode" TEXT,
    "shiftId" INTEGER,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_wallet_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pos_wallet_transactions_customerId_createdAt_idx" ON "pos_wallet_transactions"("customerId", "createdAt");
CREATE INDEX "pos_wallet_transactions_shiftId_idx" ON "pos_wallet_transactions"("shiftId");
ALTER TABLE "pos_wallet_transactions" ADD CONSTRAINT "pos_wallet_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "pos_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
