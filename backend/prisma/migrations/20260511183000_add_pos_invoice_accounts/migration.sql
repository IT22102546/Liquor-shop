CREATE TABLE IF NOT EXISTS "pos_invoice_accounts" (
  "id" SERIAL NOT NULL,
  "accountHolder" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "branchName" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pos_invoice_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_invoice_accounts_bankName_accountNumber_key"
  ON "pos_invoice_accounts"("bankName", "accountNumber");

CREATE INDEX IF NOT EXISTS "pos_invoice_accounts_sortOrder_idx"
  ON "pos_invoice_accounts"("sortOrder");

INSERT INTO "pos_invoice_accounts" (
  "accountHolder",
  "accountNumber",
  "bankName",
  "branchName",
  "sortOrder",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'JL Racing',
  '019010033205',
  'HNB',
  NULL,
  1,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "pos_invoice_accounts"
  WHERE "bankName" = 'HNB'
    AND "accountNumber" = '019010033205'
);
