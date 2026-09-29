-- Bill discounts and loyalty point redemption (both switched on/off in shop settings).
ALTER TABLE "pos_counter_sales" ADD COLUMN "discountType" TEXT;
ALTER TABLE "pos_counter_sales" ADD COLUMN "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pos_counter_sales" ADD COLUMN "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pos_counter_sales" ADD COLUMN "pointsRedeemed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pos_counter_sales" ADD COLUMN "pointsValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pos_customer_purchases" ADD COLUMN "billDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE "pos_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pos_settings_pkey" PRIMARY KEY ("key")
);
