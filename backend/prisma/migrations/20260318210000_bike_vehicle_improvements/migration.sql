-- Add year, status, soldAt columns to bike_vehicles
ALTER TABLE "bike_vehicles" ADD COLUMN IF NOT EXISTS "year" INTEGER;
ALTER TABLE "bike_vehicles" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'available';
ALTER TABLE "bike_vehicles" ADD COLUMN IF NOT EXISTS "soldAt" TIMESTAMP(3);

-- Make chassisNo, engineNo, registerNo nullable (drop NOT NULL constraint)
ALTER TABLE "bike_vehicles" ALTER COLUMN "chassisNo" DROP NOT NULL;
ALTER TABLE "bike_vehicles" ALTER COLUMN "engineNo" DROP NOT NULL;
ALTER TABLE "bike_vehicles" ALTER COLUMN "registerNo" DROP NOT NULL;

-- CreateTable bike_colors
CREATE TABLE IF NOT EXISTS "bike_colors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bike_colors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bike_colors_name_key" ON "bike_colors"("name");
