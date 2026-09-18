ALTER TABLE "pos_customer_purchases"
ADD COLUMN "hasRegistrationFee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "registrationFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX "pos_customer_purchases_hasRegistrationFee_idx"
ON "pos_customer_purchases"("hasRegistrationFee");
