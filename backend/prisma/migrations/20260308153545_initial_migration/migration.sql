-- AlterTable
ALTER TABLE "announcements" ALTER COLUMN "targetRoles" DROP DEFAULT;

-- AlterTable
ALTER TABLE "children" ADD COLUMN     "address" TEXT,
ADD COLUMN     "districtId" TEXT,
ADD COLUMN     "exerciseElbow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exerciseFingers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exerciseShoulder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exerciseWrist" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "zoneId" TEXT;

-- AlterTable
ALTER TABLE "physiotherapy_assignments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "admission_tracking" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "physiotherapistId" TEXT,
    "hospitalId" TEXT,
    "deviceId" TEXT,
    "admissionType" TEXT NOT NULL DEFAULT 'REHAB',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "admissionDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "dischargeDate" TIMESTAMP(3),
    "deviceAssignedDate" TIMESTAMP(3),
    "clinic" TEXT,
    "room" TEXT,
    "notes" TEXT,
    "manualDeviceName" TEXT,
    "manualDeviceType" TEXT,
    "manualDeviceSerial" TEXT,
    "treatmentPlanPdf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'expo',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admission_tracking_childId_idx" ON "admission_tracking"("childId");

-- CreateIndex
CREATE INDEX "admission_tracking_physiotherapistId_idx" ON "admission_tracking"("physiotherapistId");

-- CreateIndex
CREATE INDEX "admission_tracking_hospitalId_idx" ON "admission_tracking"("hospitalId");

-- CreateIndex
CREATE INDEX "admission_tracking_deviceId_idx" ON "admission_tracking"("deviceId");

-- CreateIndex
CREATE INDEX "admission_tracking_status_idx" ON "admission_tracking"("status");

-- CreateIndex
CREATE INDEX "admission_tracking_admissionDate_idx" ON "admission_tracking"("admissionDate");

-- CreateIndex
CREATE INDEX "admission_tracking_childId_admissionDate_idx" ON "admission_tracking"("childId", "admissionDate");

-- CreateIndex
CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");

-- CreateIndex
CREATE INDEX "push_tokens_isActive_idx" ON "push_tokens"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_userId_token_key" ON "push_tokens"("userId", "token");

-- CreateIndex
CREATE INDEX "children_districtId_idx" ON "children"("districtId");

-- CreateIndex
CREATE INDEX "children_zoneId_idx" ON "children"("zoneId");

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_tracking" ADD CONSTRAINT "admission_tracking_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_tracking" ADD CONSTRAINT "admission_tracking_physiotherapistId_fkey" FOREIGN KEY ("physiotherapistId") REFERENCES "hospital_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_tracking" ADD CONSTRAINT "admission_tracking_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_tracking" ADD CONSTRAINT "admission_tracking_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
