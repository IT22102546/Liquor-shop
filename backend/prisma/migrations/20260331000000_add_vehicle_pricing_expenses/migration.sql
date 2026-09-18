-- AlterTable
ALTER TABLE "bike_vehicles" ADD COLUMN "registrationType" TEXT NOT NULL DEFAULT 'unregistered';
ALTER TABLE "bike_vehicles" ADD COLUMN "purchasePrice" DOUBLE PRECISION;
ALTER TABLE "bike_vehicles" ADD COLUMN "taxAmount" DOUBLE PRECISION;
ALTER TABLE "bike_vehicles" ADD COLUMN "sellingPrice" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "bike_vehicle_expenses" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bike_vehicle_expenses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bike_vehicle_expenses" ADD CONSTRAINT "bike_vehicle_expenses_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "bike_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
