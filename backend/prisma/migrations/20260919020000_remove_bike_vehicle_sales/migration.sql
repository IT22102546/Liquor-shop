-- Remove the legacy bike-vehicle-sales feature (dream-bike wishlists, leasing,
-- bike pre-orders, export vehicles, and the bike vehicle/brand/model catalog),
-- and rename the shared "bike_suppliers" table to "suppliers" since it is
-- actually used by the active liquor inventory (inventory_products.supplierId),
-- not bike-specific infrastructure.
--
-- SAFETY NOTE (hand-authored, not generated/tested against a live database):
-- This migration was written by hand because no DATABASE_URL / reachable
-- Postgres instance was available in the environment it was authored in.
-- It has NOT been run against a real database. Review before applying.
--
-- The itemType / purchaseChannel / VoucherType enum-narrowing steps below
-- will FAIL LOUDLY (transaction rolls back, nothing is lost) if any existing
-- row still uses a value being removed ('BIKE', 'PRE_ORDER', 'LEASING',
-- 'VEHICLE_CLEARANCE', 'LEASING_PAYMENT', 'VEHICLE_PURCHASE'). That is
-- intentional: decide what to do with those historical rows (archive,
-- reassign, or delete them) before re-running this migration, rather than
-- have this script silently guess. The table drops further down ARE
-- unconditionally destructive (bike vehicles, their images/expenses, dream
-- bike wishlists, pre-orders, export vehicles, leasing companies) — that is
-- the intended outcome of removing this feature, but it means that data is
-- gone once this migration commits successfully.

-- 1. Detach pos_customer_purchases from tables being dropped.
ALTER TABLE "pos_customer_purchases" DROP CONSTRAINT IF EXISTS "pos_customer_purchases_bikeVehicleId_fkey";
ALTER TABLE "pos_customer_purchases" DROP CONSTRAINT IF EXISTS "pos_customer_purchases_preOrderId_fkey";
ALTER TABLE "pos_customer_purchases" DROP CONSTRAINT IF EXISTS "pos_customer_purchases_leasingCompanyId_fkey";

DROP INDEX IF EXISTS "pos_customer_purchases_bikeVehicleId_idx";
DROP INDEX IF EXISTS "pos_customer_purchases_preOrderId_idx";
DROP INDEX IF EXISTS "pos_customer_purchases_leasingCompanyId_idx";

ALTER TABLE "pos_customer_purchases"
  DROP COLUMN IF EXISTS "bikeVehicleId",
  DROP COLUMN IF EXISTS "preOrderId",
  DROP COLUMN IF EXISTS "leasingCompanyId",
  DROP COLUMN IF EXISTS "leasingDownPaymentAmount",
  DROP COLUMN IF EXISTS "leasingFinancedAmount",
  DROP COLUMN IF EXISTS "hasRegistrationFee",
  DROP COLUMN IF EXISTS "registrationFeeAmount";

-- 2. Narrow PosPurchaseItemType to (INVENTORY, CUSTOM).
-- Fails if any row still has itemType = 'BIKE' or 'PRE_ORDER' — handle those
-- rows first (e.g. reassign to CUSTOM or delete) if this errors.
CREATE TYPE "PosPurchaseItemType_new" AS ENUM ('INVENTORY', 'CUSTOM');
ALTER TABLE "pos_customer_purchases" ALTER COLUMN "itemType" DROP DEFAULT;
ALTER TABLE "pos_customer_purchases" ALTER COLUMN "itemType" TYPE "PosPurchaseItemType_new" USING ("itemType"::text::"PosPurchaseItemType_new");
DROP TYPE "PosPurchaseItemType";
ALTER TYPE "PosPurchaseItemType_new" RENAME TO "PosPurchaseItemType";
ALTER TABLE "pos_customer_purchases" ALTER COLUMN "itemType" SET DEFAULT 'INVENTORY';

-- 3. Narrow PosPurchaseChannel to (PERSONAL).
-- Fails if any row still has purchaseChannel = 'LEASING'.
CREATE TYPE "PosPurchaseChannel_new" AS ENUM ('PERSONAL');
ALTER TABLE "pos_customer_purchases" ALTER COLUMN "purchaseChannel" DROP DEFAULT;
ALTER TABLE "pos_customer_purchases" ALTER COLUMN "purchaseChannel" TYPE "PosPurchaseChannel_new" USING ("purchaseChannel"::text::"PosPurchaseChannel_new");
DROP TYPE "PosPurchaseChannel";
ALTER TYPE "PosPurchaseChannel_new" RENAME TO "PosPurchaseChannel";
ALTER TABLE "pos_customer_purchases" ALTER COLUMN "purchaseChannel" SET DEFAULT 'PERSONAL';

-- 4. Drop dependent bike / pre-order / export-vehicle tables (children first).
DROP TABLE IF EXISTS "pos_customer_dream_bikes" CASCADE;
DROP TABLE IF EXISTS "bike_vehicle_images" CASCADE;
DROP TABLE IF EXISTS "bike_vehicle_expenses" CASCADE;
DROP TABLE IF EXISTS "pre_order_images" CASCADE;
DROP TABLE IF EXISTS "export_vehicle_images" CASCADE;
DROP TABLE IF EXISTS "bike_vehicles" CASCADE;
DROP TABLE IF EXISTS "bike_models" CASCADE;
DROP TABLE IF EXISTS "bike_brands" CASCADE;
DROP TABLE IF EXISTS "bike_colors" CASCADE;
DROP TABLE IF EXISTS "pre_orders" CASCADE;
DROP TABLE IF EXISTS "export_vehicles" CASCADE;
DROP TABLE IF EXISTS "pos_leasing_companies" CASCADE;
DROP TABLE IF EXISTS "bikes" CASCADE;
DROP TYPE IF EXISTS "ExportVehicleCategory";

-- 5. Rename the shared supplier table (not bike-specific — inventory_products
-- depends on it). Table rename preserves the existing FK and all data.
ALTER TABLE "bike_suppliers" RENAME TO "suppliers";
ALTER TABLE "suppliers" RENAME CONSTRAINT "bike_suppliers_pkey" TO "suppliers_pkey";
ALTER INDEX IF EXISTS "bike_suppliers_code_key" RENAME TO "suppliers_code_key";
ALTER SEQUENCE IF EXISTS "bike_suppliers_id_seq" RENAME TO "suppliers_id_seq";

-- 6. Narrow VoucherType to drop the vehicle/leasing voucher categories.
-- Fails if any account_vouchers row still uses 'VEHICLE_CLEARANCE',
-- 'LEASING_PAYMENT', or 'VEHICLE_PURCHASE'.
CREATE TYPE "VoucherType_new" AS ENUM ('BILL', 'OTHER_PAYMENT', 'PERMIT', 'LOAN_PAYMENT', 'SALARY', 'CUSTOMER_REFUND', 'ADVANCE_REFUND', 'ACCOUNT_TRANSFER');
ALTER TABLE "account_vouchers" ALTER COLUMN "type" TYPE "VoucherType_new" USING ("type"::text::"VoucherType_new");
DROP TYPE "VoucherType";
ALTER TYPE "VoucherType_new" RENAME TO "VoucherType";
