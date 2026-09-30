-- Safe retries: the till's own id for each bill, and the first answer to send back if it arrives twice.
ALTER TABLE "pos_counter_sales" ADD COLUMN "checkoutResult" JSONB,
ADD COLUMN "clientRef" TEXT;

CREATE UNIQUE INDEX "pos_counter_sales_clientRef_key" ON "pos_counter_sales"("clientRef");
