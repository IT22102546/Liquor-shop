-- Add condition, mileage, and description fields to bike_vehicles
ALTER TABLE "bike_vehicles" ADD COLUMN IF NOT EXISTS "condition" TEXT NOT NULL DEFAULT 'brandnew';
ALTER TABLE "bike_vehicles" ADD COLUMN IF NOT EXISTS "mileage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bike_vehicles" ADD COLUMN IF NOT EXISTS "description" TEXT;
