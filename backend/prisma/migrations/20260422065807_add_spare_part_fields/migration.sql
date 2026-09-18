/*
  Warnings:

  - You are about to drop the `admission_tracking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `announcements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `appointments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `children` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `credential_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `device_assignments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `devices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `districts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `hospital_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `hospital_staff` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `hospitals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `movement_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `parent_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `physio_unavailable_dates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `physiotherapy_assignments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `progress_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `provinces` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `publications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `push_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sub_hospitals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `system_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `therapy_programs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `therapy_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `zones` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "admission_tracking" DROP CONSTRAINT "admission_tracking_childId_fkey";

-- DropForeignKey
ALTER TABLE "admission_tracking" DROP CONSTRAINT "admission_tracking_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "admission_tracking" DROP CONSTRAINT "admission_tracking_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "admission_tracking" DROP CONSTRAINT "admission_tracking_physiotherapistId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_childId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_staffId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_subHospitalId_fkey";

-- DropForeignKey
ALTER TABLE "children" DROP CONSTRAINT "child_hospital_fkey";

-- DropForeignKey
ALTER TABLE "children" DROP CONSTRAINT "child_parent_profile_fkey";

-- DropForeignKey
ALTER TABLE "children" DROP CONSTRAINT "child_subhospital_fkey";

-- DropForeignKey
ALTER TABLE "children" DROP CONSTRAINT "children_districtId_fkey";

-- DropForeignKey
ALTER TABLE "children" DROP CONSTRAINT "children_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "credential_logs" DROP CONSTRAINT "credential_logs_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "device_assignments" DROP CONSTRAINT "device_assignments_childId_fkey";

-- DropForeignKey
ALTER TABLE "device_assignments" DROP CONSTRAINT "device_assignments_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "devices" DROP CONSTRAINT "devices_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "districts" DROP CONSTRAINT "districts_provinceId_fkey";

-- DropForeignKey
ALTER TABLE "hospital_profiles" DROP CONSTRAINT "hospital_profiles_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "hospital_staff" DROP CONSTRAINT "hospital_staff_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "hospital_staff" DROP CONSTRAINT "hospital_staff_subHospitalId_fkey";

-- DropForeignKey
ALTER TABLE "hospitals" DROP CONSTRAINT "hospitals_districtId_fkey";

-- DropForeignKey
ALTER TABLE "hospitals" DROP CONSTRAINT "hospitals_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "movement_logs" DROP CONSTRAINT "movement_logs_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "movement_logs" DROP CONSTRAINT "movement_logs_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "physio_unavailable_dates" DROP CONSTRAINT "physio_unavailable_dates_staffId_fkey";

-- DropForeignKey
ALTER TABLE "physiotherapy_assignments" DROP CONSTRAINT "physiotherapy_assignments_childId_fkey";

-- DropForeignKey
ALTER TABLE "physiotherapy_assignments" DROP CONSTRAINT "physiotherapy_assignments_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "physiotherapy_assignments" DROP CONSTRAINT "physiotherapy_assignments_physiotherapistId_fkey";

-- DropForeignKey
ALTER TABLE "pos_customer_purchases" DROP CONSTRAINT "pos_customer_purchases_bikeVehicleId_fkey";

-- DropForeignKey
ALTER TABLE "progress_records" DROP CONSTRAINT "progress_records_childId_fkey";

-- DropForeignKey
ALTER TABLE "progress_records" DROP CONSTRAINT "progress_records_programId_fkey";

-- DropForeignKey
ALTER TABLE "publications" DROP CONSTRAINT "publications_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "sub_hospitals" DROP CONSTRAINT "sub_hospitals_districtId_fkey";

-- DropForeignKey
ALTER TABLE "sub_hospitals" DROP CONSTRAINT "sub_hospitals_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "sub_hospitals" DROP CONSTRAINT "sub_hospitals_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "therapy_programs" DROP CONSTRAINT "therapy_programs_childId_fkey";

-- DropForeignKey
ALTER TABLE "therapy_sessions" DROP CONSTRAINT "therapy_sessions_childId_fkey";

-- DropForeignKey
ALTER TABLE "therapy_sessions" DROP CONSTRAINT "therapy_sessions_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "therapy_sessions" DROP CONSTRAINT "therapy_sessions_programId_fkey";

-- DropForeignKey
ALTER TABLE "zones" DROP CONSTRAINT "zones_districtId_fkey";

-- DropIndex
DROP INDEX "bike_vehicles_supplierId_idx";

-- DropIndex
DROP INDEX "pos_customer_purchases_hasRegistrationFee_idx";

-- AlterTable
ALTER TABLE "inventory_products" ADD COLUMN     "compatibleWith" TEXT,
ADD COLUMN     "partNumber" TEXT;

-- AlterTable
ALTER TABLE "pos_invoice_terms" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pos_leasing_companies" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "admission_tracking";

-- DropTable
DROP TABLE "announcements";

-- DropTable
DROP TABLE "appointments";

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "children";

-- DropTable
DROP TABLE "credential_logs";

-- DropTable
DROP TABLE "device_assignments";

-- DropTable
DROP TABLE "devices";

-- DropTable
DROP TABLE "districts";

-- DropTable
DROP TABLE "hospital_profiles";

-- DropTable
DROP TABLE "hospital_staff";

-- DropTable
DROP TABLE "hospitals";

-- DropTable
DROP TABLE "movement_logs";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "parent_profiles";

-- DropTable
DROP TABLE "physio_unavailable_dates";

-- DropTable
DROP TABLE "physiotherapy_assignments";

-- DropTable
DROP TABLE "progress_records";

-- DropTable
DROP TABLE "provinces";

-- DropTable
DROP TABLE "publications";

-- DropTable
DROP TABLE "push_tokens";

-- DropTable
DROP TABLE "sub_hospitals";

-- DropTable
DROP TABLE "system_settings";

-- DropTable
DROP TABLE "therapy_programs";

-- DropTable
DROP TABLE "therapy_sessions";

-- DropTable
DROP TABLE "zones";

-- DropEnum
DROP TYPE "AppointmentType";

-- DropEnum
DROP TYPE "DeviceType";

-- DropEnum
DROP TYPE "GameType";

-- DropEnum
DROP TYPE "HospitalStatus";

-- DropEnum
DROP TYPE "HospitalType";

-- DropEnum
DROP TYPE "MovementType";

-- DropEnum
DROP TYPE "SessionStatus";

-- DropEnum
DROP TYPE "TherapyProgramStatus";

-- DropEnum
DROP TYPE "UserRole";

-- DropEnum
DROP TYPE "UserStatus";

-- AddForeignKey
ALTER TABLE "pos_customer_purchases" ADD CONSTRAINT "pos_customer_purchases_bikeVehicleId_fkey" FOREIGN KEY ("bikeVehicleId") REFERENCES "bike_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
