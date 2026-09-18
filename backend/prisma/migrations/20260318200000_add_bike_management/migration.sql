-- CreateTable
CREATE TABLE "bike_brands" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bike_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bike_models" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bike_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bike_colors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bike_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bike_vehicles" (
    "id" SERIAL NOT NULL,
    "displayId" TEXT NOT NULL,
    "brandId" INTEGER NOT NULL,
    "modelId" INTEGER NOT NULL,
    "colour" TEXT NOT NULL,
    "year" INTEGER,
    "fileNo" TEXT,
    "manufactureDate" TEXT,
    "registerNo" TEXT,
    "chassisNo" TEXT,
    "engineNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bike_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bike_brands_name_key" ON "bike_brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bike_models_name_brandId_key" ON "bike_models"("name", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "bike_colors_name_key" ON "bike_colors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bike_vehicles_displayId_key" ON "bike_vehicles"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "bike_vehicles_registerNo_key" ON "bike_vehicles"("registerNo");

-- CreateIndex
CREATE UNIQUE INDEX "bike_vehicles_chassisNo_key" ON "bike_vehicles"("chassisNo");

-- CreateIndex
CREATE UNIQUE INDEX "bike_vehicles_engineNo_key" ON "bike_vehicles"("engineNo");

-- AddForeignKey
ALTER TABLE "bike_models" ADD CONSTRAINT "bike_models_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "bike_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bike_vehicles" ADD CONSTRAINT "bike_vehicles_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "bike_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bike_vehicles" ADD CONSTRAINT "bike_vehicles_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "bike_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
