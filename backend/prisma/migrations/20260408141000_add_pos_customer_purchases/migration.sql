-- CreateTable
CREATE TABLE "pos_customer_purchases" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "bikeVehicleId" INTEGER NOT NULL,
    "currentSellingPrice" DOUBLE PRECISION,
    "finalSellingPrice" DOUBLE PRECISION NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_customer_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_customer_purchases_customerId_idx" ON "pos_customer_purchases"("customerId");

-- CreateIndex
CREATE INDEX "pos_customer_purchases_bikeVehicleId_idx" ON "pos_customer_purchases"("bikeVehicleId");

-- AddForeignKey
ALTER TABLE "pos_customer_purchases"
ADD CONSTRAINT "pos_customer_purchases_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "pos_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_customer_purchases"
ADD CONSTRAINT "pos_customer_purchases_bikeVehicleId_fkey"
FOREIGN KEY ("bikeVehicleId") REFERENCES "bike_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
