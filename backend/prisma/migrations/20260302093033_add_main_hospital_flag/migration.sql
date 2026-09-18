-- AlterTable
ALTER TABLE "children" ALTER COLUMN "diagnosis" DROP NOT NULL;

-- AlterTable
ALTER TABLE "hospitals" ADD COLUMN     "isMainHospital" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "hospitals_isMainHospital_idx" ON "hospitals"("isMainHospital");
