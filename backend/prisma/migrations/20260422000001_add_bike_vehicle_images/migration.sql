-- CreateTable
CREATE TABLE "bike_vehicle_images" (
    "id"        SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "url"       TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bike_vehicle_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bike_vehicle_images"
ADD CONSTRAINT "bike_vehicle_images_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "bike_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
