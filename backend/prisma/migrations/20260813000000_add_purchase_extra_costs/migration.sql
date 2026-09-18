ALTER TABLE "pos_customer_purchases"
ADD COLUMN "extraCosts" JSONB NOT NULL DEFAULT '[]'::jsonb;
