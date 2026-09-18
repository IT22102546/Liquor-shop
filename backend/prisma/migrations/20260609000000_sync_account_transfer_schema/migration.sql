DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountType') THEN
    CREATE TYPE "AccountType" AS ENUM ('BANK', 'CASH');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHEQUE', 'BANK_TRANSFER');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChequeStatus') THEN
    CREATE TYPE "ChequeStatus" AS ENUM ('PENDING', 'CLEARED', 'BOUNCED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VoucherType') THEN
    CREATE TYPE "VoucherType" AS ENUM (
      'VEHICLE_CLEARANCE',
      'BILL',
      'OTHER_PAYMENT',
      'PERMIT',
      'LEASING_PAYMENT',
      'LOAN_PAYMENT',
      'SALARY',
      'CUSTOMER_REFUND',
      'VEHICLE_PURCHASE',
      'ADVANCE_REFUND',
      'ACCOUNT_TRANSFER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionType') THEN
    CREATE TYPE "TransactionType" AS ENUM ('RECEIPT', 'VOUCHER', 'REVERSAL', 'DEPOSIT', 'TRANSFER');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionDirection') THEN
    CREATE TYPE "TransactionDirection" AS ENUM ('DR', 'CR');
  END IF;
END $$;

ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'VEHICLE_CLEARANCE';
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'BILL';
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'OTHER_PAYMENT';
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'PERMIT';
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'LEASING_PAYMENT';
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'LOAN_PAYMENT';
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'SALARY';
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'CUSTOMER_REFUND';
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'VEHICLE_PURCHASE';
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'ADVANCE_REFUND';
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'ACCOUNT_TRANSFER';

ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'RECEIPT';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'VOUCHER';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'REVERSAL';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'DEPOSIT';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TRANSFER';

ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'BANK';
ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'CASH';

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CASH';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHEQUE';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';

ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'CLEARED';
ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'BOUNCED';

ALTER TYPE "TransactionDirection" ADD VALUE IF NOT EXISTS 'DR';
ALTER TYPE "TransactionDirection" ADD VALUE IF NOT EXISTS 'CR';

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "AccountType" NOT NULL DEFAULT 'BANK',
  "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "account_receipts" (
  "id" SERIAL NOT NULL,
  "receiptNo" TEXT NOT NULL,
  "purchaseId" INTEGER NOT NULL,
  "accountId" INTEGER,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "chequeNo" TEXT,
  "chequeBank" TEXT,
  "chequeDate" TIMESTAMP(3),
  "chequeStatus" "ChequeStatus",
  "description" TEXT,
  "isVoided" BOOLEAN NOT NULL DEFAULT false,
  "isDeposited" BOOLEAN NOT NULL DEFAULT false,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "account_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "account_vouchers" (
  "id" SERIAL NOT NULL,
  "voucherNo" TEXT NOT NULL,
  "accountId" INTEGER NOT NULL,
  "toAccountId" INTEGER,
  "type" "VoucherType" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "description" TEXT,
  "payee" TEXT,
  "paymentDate" TIMESTAMP(3),
  "referenceNo" TEXT,
  "isVoided" BOOLEAN NOT NULL DEFAULT false,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "account_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "invoice_payments" (
  "id" SERIAL NOT NULL,
  "purchaseId" INTEGER NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "chequeNo" TEXT,
  "chequeBank" TEXT,
  "chequeDate" TIMESTAMP(3),
  "description" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receiptId" INTEGER,

  CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "account_deposits" (
  "id" SERIAL NOT NULL,
  "depositNo" TEXT NOT NULL,
  "accountId" INTEGER NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "isReversed" BOOLEAN NOT NULL DEFAULT false,
  "reversedAt" TIMESTAMP(3),
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "account_deposits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "account_transactions" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "type" "TransactionType" NOT NULL,
  "direction" "TransactionDirection" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "receiptId" INTEGER,
  "voucherId" INTEGER,
  "depositId" INTEGER,
  "refNo" TEXT,
  "description" TEXT,
  "chequeNo" TEXT,
  "isReversal" BOOLEAN NOT NULL DEFAULT false,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "account_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "account_deposit_items" (
  "id" SERIAL NOT NULL,
  "depositId" INTEGER NOT NULL,
  "receiptId" INTEGER NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,

  CONSTRAINT "account_deposit_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "account_vouchers" ADD COLUMN IF NOT EXISTS "toAccountId" INTEGER;
ALTER TABLE "account_vouchers" ADD COLUMN IF NOT EXISTS "payee" TEXT;
ALTER TABLE "account_vouchers" ADD COLUMN IF NOT EXISTS "paymentDate" TIMESTAMP(3);
ALTER TABLE "account_vouchers" ADD COLUMN IF NOT EXISTS "referenceNo" TEXT;
ALTER TABLE "account_receipts" ADD COLUMN IF NOT EXISTS "isDeposited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "account_transactions" ADD COLUMN IF NOT EXISTS "depositId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_code_key" ON "accounts"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "account_receipts_receiptNo_key" ON "account_receipts"("receiptNo");
CREATE INDEX IF NOT EXISTS "account_receipts_purchaseId_idx" ON "account_receipts"("purchaseId");
CREATE INDEX IF NOT EXISTS "account_receipts_accountId_idx" ON "account_receipts"("accountId");
CREATE UNIQUE INDEX IF NOT EXISTS "account_vouchers_voucherNo_key" ON "account_vouchers"("voucherNo");
CREATE INDEX IF NOT EXISTS "account_vouchers_accountId_idx" ON "account_vouchers"("accountId");
CREATE INDEX IF NOT EXISTS "account_vouchers_toAccountId_idx" ON "account_vouchers"("toAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_payments_receiptId_key" ON "invoice_payments"("receiptId");
CREATE INDEX IF NOT EXISTS "invoice_payments_purchaseId_idx" ON "invoice_payments"("purchaseId");
CREATE UNIQUE INDEX IF NOT EXISTS "account_deposits_depositNo_key" ON "account_deposits"("depositNo");
CREATE INDEX IF NOT EXISTS "account_deposits_accountId_idx" ON "account_deposits"("accountId");
CREATE INDEX IF NOT EXISTS "account_transactions_accountId_idx" ON "account_transactions"("accountId");
CREATE INDEX IF NOT EXISTS "account_transactions_receiptId_idx" ON "account_transactions"("receiptId");
CREATE INDEX IF NOT EXISTS "account_transactions_voucherId_idx" ON "account_transactions"("voucherId");
CREATE INDEX IF NOT EXISTS "account_transactions_depositId_idx" ON "account_transactions"("depositId");
CREATE UNIQUE INDEX IF NOT EXISTS "account_deposit_items_receiptId_key" ON "account_deposit_items"("receiptId");
CREATE INDEX IF NOT EXISTS "account_deposit_items_depositId_idx" ON "account_deposit_items"("depositId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_receipts_accountId_fkey') THEN
    ALTER TABLE "account_receipts"
      ADD CONSTRAINT "account_receipts_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_receipts_purchaseId_fkey') THEN
    ALTER TABLE "account_receipts"
      ADD CONSTRAINT "account_receipts_purchaseId_fkey"
      FOREIGN KEY ("purchaseId") REFERENCES "pos_customer_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_vouchers_accountId_fkey') THEN
    ALTER TABLE "account_vouchers"
      ADD CONSTRAINT "account_vouchers_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_vouchers_toAccountId_fkey') THEN
    ALTER TABLE "account_vouchers"
      ADD CONSTRAINT "account_vouchers_toAccountId_fkey"
      FOREIGN KEY ("toAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payments_purchaseId_fkey') THEN
    ALTER TABLE "invoice_payments"
      ADD CONSTRAINT "invoice_payments_purchaseId_fkey"
      FOREIGN KEY ("purchaseId") REFERENCES "pos_customer_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payments_receiptId_fkey') THEN
    ALTER TABLE "invoice_payments"
      ADD CONSTRAINT "invoice_payments_receiptId_fkey"
      FOREIGN KEY ("receiptId") REFERENCES "account_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_deposits_accountId_fkey') THEN
    ALTER TABLE "account_deposits"
      ADD CONSTRAINT "account_deposits_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_transactions_accountId_fkey') THEN
    ALTER TABLE "account_transactions"
      ADD CONSTRAINT "account_transactions_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_transactions_receiptId_fkey') THEN
    ALTER TABLE "account_transactions"
      ADD CONSTRAINT "account_transactions_receiptId_fkey"
      FOREIGN KEY ("receiptId") REFERENCES "account_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_transactions_voucherId_fkey') THEN
    ALTER TABLE "account_transactions"
      ADD CONSTRAINT "account_transactions_voucherId_fkey"
      FOREIGN KEY ("voucherId") REFERENCES "account_vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_transactions_depositId_fkey') THEN
    ALTER TABLE "account_transactions"
      ADD CONSTRAINT "account_transactions_depositId_fkey"
      FOREIGN KEY ("depositId") REFERENCES "account_deposits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_deposit_items_depositId_fkey') THEN
    ALTER TABLE "account_deposit_items"
      ADD CONSTRAINT "account_deposit_items_depositId_fkey"
      FOREIGN KEY ("depositId") REFERENCES "account_deposits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_deposit_items_receiptId_fkey') THEN
    ALTER TABLE "account_deposit_items"
      ADD CONSTRAINT "account_deposit_items_receiptId_fkey"
      FOREIGN KEY ("receiptId") REFERENCES "account_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
