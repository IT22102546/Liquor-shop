DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountLevel') THEN
    CREATE TYPE "AccountLevel" AS ENUM ('MAIN', 'SUB');
  END IF;
END $$;

ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "level" "AccountLevel" NOT NULL DEFAULT 'MAIN';

CREATE TABLE IF NOT EXISTS "account_relationships" (
  "mainAccountId" INTEGER NOT NULL,
  "subAccountId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "account_relationships_pkey" PRIMARY KEY ("mainAccountId", "subAccountId")
);

CREATE INDEX IF NOT EXISTS "account_relationships_subAccountId_idx"
  ON "account_relationships"("subAccountId");

ALTER TABLE "account_relationships"
  DROP CONSTRAINT IF EXISTS "account_relationships_mainAccountId_fkey";
ALTER TABLE "account_relationships"
  ADD CONSTRAINT "account_relationships_mainAccountId_fkey"
  FOREIGN KEY ("mainAccountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account_relationships"
  DROP CONSTRAINT IF EXISTS "account_relationships_subAccountId_fkey";
ALTER TABLE "account_relationships"
  ADD CONSTRAINT "account_relationships_subAccountId_fkey"
  FOREIGN KEY ("subAccountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account_deposits"
  ADD COLUMN IF NOT EXISTS "subAccountId" INTEGER;

CREATE INDEX IF NOT EXISTS "account_deposits_subAccountId_idx"
  ON "account_deposits"("subAccountId");

ALTER TABLE "account_deposits"
  DROP CONSTRAINT IF EXISTS "account_deposits_subAccountId_fkey";
ALTER TABLE "account_deposits"
  ADD CONSTRAINT "account_deposits_subAccountId_fkey"
  FOREIGN KEY ("subAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
