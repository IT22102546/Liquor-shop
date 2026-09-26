-- Shift takings wait in the safe / with the card company until someone marks them as banked.
ALTER TABLE "pos_cash_entries" ADD COLUMN "bankStatus" TEXT;
ALTER TABLE "pos_cash_entries" ADD COLUMN "bankedAt" TIMESTAMP(3);
ALTER TABLE "pos_cash_entries" ADD COLUMN "bankedById" INTEGER;
ALTER TABLE "pos_cash_entries" ADD COLUMN "bankReference" TEXT;
CREATE INDEX "pos_cash_entries_bankStatus_idx" ON "pos_cash_entries"("bankStatus");
