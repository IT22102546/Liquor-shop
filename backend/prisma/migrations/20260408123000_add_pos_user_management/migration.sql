-- CreateTable
CREATE TABLE "pos_customers" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nic" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "email" TEXT,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_customer_dream_bikes" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "bikeVehicleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_customer_dream_bikes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_customers_nic_key" ON "pos_customers"("nic");

-- CreateIndex
CREATE UNIQUE INDEX "pos_customers_mobileNumber_key" ON "pos_customers"("mobileNumber");

-- CreateIndex
CREATE UNIQUE INDEX "pos_customers_email_key" ON "pos_customers"("email");

-- CreateIndex
CREATE INDEX "pos_customers_firstName_idx" ON "pos_customers"("firstName");

-- CreateIndex
CREATE INDEX "pos_customers_lastName_idx" ON "pos_customers"("lastName");

-- CreateIndex
CREATE INDEX "pos_customers_province_idx" ON "pos_customers"("province");

-- CreateIndex
CREATE INDEX "pos_customers_district_idx" ON "pos_customers"("district");

-- CreateIndex
CREATE UNIQUE INDEX "pos_customer_dream_bikes_customerId_bikeVehicleId_key" ON "pos_customer_dream_bikes"("customerId", "bikeVehicleId");

-- CreateIndex
CREATE INDEX "pos_customer_dream_bikes_bikeVehicleId_idx" ON "pos_customer_dream_bikes"("bikeVehicleId");

-- AddForeignKey
ALTER TABLE "pos_customer_dream_bikes"
ADD CONSTRAINT "pos_customer_dream_bikes_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "pos_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_customer_dream_bikes"
ADD CONSTRAINT "pos_customer_dream_bikes_bikeVehicleId_fkey"
FOREIGN KEY ("bikeVehicleId") REFERENCES "bike_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
