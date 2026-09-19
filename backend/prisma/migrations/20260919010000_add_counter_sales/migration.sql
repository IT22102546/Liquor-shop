CREATE TABLE "pos_counter_sales" (
  "id" SERIAL NOT NULL,
  "invoiceGroupCode" TEXT NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "amountReceived" DOUBLE PRECISION NOT NULL,
  "changeGiven" DOUBLE PRECISION NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "cashierId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pos_counter_sales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_counter_sales_invoiceGroupCode_key"
  ON "pos_counter_sales"("invoiceGroupCode");
CREATE INDEX "pos_counter_sales_cashierId_idx"
  ON "pos_counter_sales"("cashierId");
CREATE INDEX "pos_counter_sales_createdAt_idx"
  ON "pos_counter_sales"("createdAt");

ALTER TABLE "pos_counter_sales"
  ADD CONSTRAINT "pos_counter_sales_cashierId_fkey"
  FOREIGN KEY ("cashierId") REFERENCES "pos_admins"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
