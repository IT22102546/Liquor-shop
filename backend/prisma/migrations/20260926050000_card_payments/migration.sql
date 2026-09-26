-- Card payments separate from bank transfer / QR, with the approval code from the card slip.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CARD';
ALTER TABLE "pos_counter_sales" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "pos_shifts" ADD COLUMN "cardDifferenceReason" TEXT;
