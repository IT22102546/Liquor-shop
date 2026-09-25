/*
  Warnings:

  - You are about to drop the `pos_invoice_accounts` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- AlterTable
ALTER TABLE "pos_customer_purchases" ADD COLUMN     "installmentMonths" INTEGER,
ADD COLUMN     "interestRate" DOUBLE PRECISION,
ADD COLUMN     "monthlyInstallmentAmount" DOUBLE PRECISION,
ADD COLUMN     "totalWithInterest" DOUBLE PRECISION;

-- DropTable
DROP TABLE "pos_invoice_accounts";

-- CreateTable
CREATE TABLE "pos_installments" (
    "id" SERIAL NOT NULL,
    "purchaseId" INTEGER NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dueAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "penaltyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "penaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_installment_payments" (
    "id" SERIAL NOT NULL,
    "installmentId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "penaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_installment_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_installments_purchaseId_idx" ON "pos_installments"("purchaseId");

-- CreateIndex
CREATE INDEX "pos_installment_payments_installmentId_idx" ON "pos_installment_payments"("installmentId");

-- AddForeignKey
ALTER TABLE "pos_installments" ADD CONSTRAINT "pos_installments_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "pos_customer_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_installment_payments" ADD CONSTRAINT "pos_installment_payments_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "pos_installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
