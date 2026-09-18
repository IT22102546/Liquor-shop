-- AlterTable: Add displayId column to users (nullable first)
ALTER TABLE "users" ADD COLUMN "displayId" TEXT;

-- Backfill existing users with sequential display IDs
WITH numbered_users AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
  FROM "users"
  WHERE "displayId" IS NULL
)
UPDATE "users"
SET "displayId" = 'AGU-' || LPAD(nu.rn::TEXT, 4, '0')
FROM numbered_users nu
WHERE "users".id = nu.id;

-- Make displayId NOT NULL and UNIQUE
ALTER TABLE "users" ALTER COLUMN "displayId" SET NOT NULL;
CREATE UNIQUE INDEX "users_displayId_key" ON "users"("displayId");

-- AlterTable: Add displayId column to children (nullable first)
ALTER TABLE "children" ADD COLUMN "displayId" TEXT;

-- Backfill existing children with sequential display IDs
WITH numbered_children AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "enrolledAt" ASC) AS rn
  FROM "children"
  WHERE "displayId" IS NULL
)
UPDATE "children"
SET "displayId" = 'AG-' || LPAD(nc.rn::TEXT, 4, '0')
FROM numbered_children nc
WHERE "children".id = nc.id;

-- Make displayId NOT NULL and UNIQUE
ALTER TABLE "children" ALTER COLUMN "displayId" SET NOT NULL;
CREATE UNIQUE INDEX "children_displayId_key" ON "children"("displayId");
