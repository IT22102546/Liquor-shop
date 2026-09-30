-- Gift vouchers (sold or free, used once in full at any branch) and the voucher part of each bill.
ALTER TABLE "pos_counter_sales" ADD COLUMN     "voucherFree" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "voucherPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "pos_gift_vouchers" (
    "id" SERIAL NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "issuedTo" TEXT,
    "issuedPhone" TEXT,
    "customerId" INTEGER,
    "note" TEXT,
    "issuedById" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueBranchId" INTEGER,
    "issueShiftId" INTEGER,
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "redeemedById" INTEGER,
    "redeemedBranchId" INTEGER,
    "redeemedShiftId" INTEGER,
    "redeemedBillNo" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" INTEGER,
    "cancelReason" TEXT,

    CONSTRAINT "pos_gift_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_gift_vouchers_voucherNo_key" ON "pos_gift_vouchers"("voucherNo");

-- CreateIndex
CREATE UNIQUE INDEX "pos_gift_vouchers_code_key" ON "pos_gift_vouchers"("code");

-- CreateIndex
CREATE INDEX "pos_gift_vouchers_status_idx" ON "pos_gift_vouchers"("status");

-- CreateIndex
CREATE INDEX "pos_gift_vouchers_issueShiftId_idx" ON "pos_gift_vouchers"("issueShiftId");

-- CreateIndex
CREATE INDEX "pos_gift_vouchers_redeemedShiftId_idx" ON "pos_gift_vouchers"("redeemedShiftId");

-- CreateIndex
CREATE INDEX "pos_gift_vouchers_redeemedBillNo_idx" ON "pos_gift_vouchers"("redeemedBillNo");

-- CreateIndex
CREATE INDEX "pos_gift_vouchers_issueBranchId_issuedAt_idx" ON "pos_gift_vouchers"("issueBranchId", "issuedAt");

-- CreateIndex
CREATE INDEX "pos_gift_vouchers_redeemedBranchId_redeemedAt_idx" ON "pos_gift_vouchers"("redeemedBranchId", "redeemedAt");

