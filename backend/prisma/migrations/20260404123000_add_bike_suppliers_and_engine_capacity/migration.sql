-- CreateTable
CREATE TABLE "bike_suppliers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contactPerson" TEXT,
    "telephone" TEXT,
    "address" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "vatRegistrationNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bike_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bike_suppliers_code_key" ON "bike_suppliers"("code");

-- AlterTable
ALTER TABLE "bike_vehicles" ADD COLUMN "supplierId" INTEGER;
ALTER TABLE "bike_vehicles" ADD COLUMN "engineCapacityCc" INTEGER;

-- CreateIndex
CREATE INDEX "bike_vehicles_supplierId_idx" ON "bike_vehicles"("supplierId");

-- AddForeignKey
ALTER TABLE "bike_vehicles" ADD CONSTRAINT "bike_vehicles_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "bike_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
