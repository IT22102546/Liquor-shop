-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PARENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('FINGER_GLOVE', 'WRIST_BAND', 'ELBOW_BRACE', 'SHOULDER_SUPPORT');

-- CreateEnum
CREATE TYPE "TherapyProgramStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED', 'PENDING');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('ASSESSMENT', 'THERAPY_SESSION', 'FOLLOW_UP', 'PARENT_TRAINING');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('FLEXION', 'EXTENSION', 'ABDUCTION', 'ADDUCTION', 'CIRCUMDUCTION', 'PRONATION', 'SUPINATION', 'RADIAL_DEVIATION', 'ULNAR_DEVIATION');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('FINGER_FUN', 'WRIST_WIZARDRY', 'ELBOW_QUESTS', 'SHOULDER_STRENGTH', 'MIXED_ADVENTURE');

-- CreateEnum
CREATE TYPE "HospitalType" AS ENUM ('GOVERNMENT', 'PRIVATE', 'SPECIALIZED_CHILDREN', 'REHABILITATION_CENTER', 'CLINIC');

-- CreateEnum
CREATE TYPE "HospitalStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING_APPROVAL', 'SUSPENDED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "avatar" TEXT,
    "address" TEXT,
    "city" TEXT,
    "districtId" TEXT,
    "zoneId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occupation" TEXT,
    "preferredContact" TEXT,

    CONSTRAINT "parent_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "type" "HospitalType" NOT NULL,
    "status" "HospitalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "website" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "zoneId" TEXT,
    "postalCode" TEXT,
    "establishedYear" INTEGER,
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "bedCapacity" INTEGER,
    "specialization" TEXT[],
    "totalDoctors" INTEGER,
    "totalTherapists" INTEGER,
    "totalStaff" INTEGER,
    "createdById" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "adminPassword" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "department" TEXT,
    "designation" TEXT,
    "qualifications" TEXT[],

    CONSTRAINT "hospital_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_hospitals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNo" TEXT,
    "hospitalId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "zoneId" TEXT,
    "type" TEXT,
    "inChargeName" TEXT,
    "inChargePhone" TEXT,
    "totalStaff" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_staff" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "subHospitalId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "specialization" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "employeeId" TEXT,
    "qualifications" TEXT[],
    "experience" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "hospital_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "hospitalId" TEXT,
    "subHospitalId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "diagnosisDate" TIMESTAMP(3),
    "medicalNotes" TEXT,
    "assignedDoctor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT,
    "deviceType" "DeviceType" NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "modelNumber" TEXT,
    "manufacturer" TEXT,
    "firmwareVersion" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "warrantyExpiry" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "supplier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "condition" TEXT,
    "lastMaintenance" TIMESTAMP(3),
    "nextMaintenance" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_assignments" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "device_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapy_programs" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "TherapyProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "gameType" "GameType" NOT NULL,
    "difficultyLevel" TEXT NOT NULL,
    "targetMovements" "MovementType"[],
    "sessionDuration" INTEGER NOT NULL,
    "sessionsPerWeek" INTEGER NOT NULL,

    CONSTRAINT "therapy_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapy_sessions" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "programId" TEXT,
    "deviceId" TEXT,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "gameType" "GameType",
    "gameLevel" TEXT,
    "score" INTEGER,
    "accuracy" DOUBLE PRECISION,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "therapistNotes" TEXT,
    "parentNotes" TEXT,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "therapy_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movement_logs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "duration" INTEGER,
    "repetitions" INTEGER,
    "quality" DOUBLE PRECISION,

    CONSTRAINT "movement_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_records" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "programId" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "movementType" "MovementType" NOT NULL,
    "baselineValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "improvement" DOUBLE PRECISION,
    "totalSessions" INTEGER,
    "completedSessions" INTEGER,
    "averageScore" DOUBLE PRECISION,
    "bestScore" DOUBLE PRECISION,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "progress_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "hospitalId" TEXT,
    "subHospitalId" TEXT,
    "staffId" TEXT,
    "parentId" TEXT NOT NULL,
    "appointmentType" "AppointmentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "meetingLink" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provinces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "provinceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "districtId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "oldValues" TEXT,
    "newValues" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_logs" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "passwordReset" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "credential_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "parent_profiles_userId_key" ON "parent_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_name_key" ON "hospitals"("name");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_registrationNo_key" ON "hospitals"("registrationNo");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_email_key" ON "hospitals"("email");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_adminEmail_key" ON "hospitals"("adminEmail");

-- CreateIndex
CREATE INDEX "hospitals_status_idx" ON "hospitals"("status");

-- CreateIndex
CREATE INDEX "hospitals_districtId_idx" ON "hospitals"("districtId");

-- CreateIndex
CREATE INDEX "hospitals_zoneId_idx" ON "hospitals"("zoneId");

-- CreateIndex
CREATE INDEX "hospitals_type_idx" ON "hospitals"("type");

-- CreateIndex
CREATE INDEX "hospitals_createdById_idx" ON "hospitals"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_profiles_userId_key" ON "hospital_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_profiles_hospitalId_key" ON "hospital_profiles"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "sub_hospitals_registrationNo_key" ON "sub_hospitals"("registrationNo");

-- CreateIndex
CREATE INDEX "sub_hospitals_hospitalId_idx" ON "sub_hospitals"("hospitalId");

-- CreateIndex
CREATE INDEX "sub_hospitals_districtId_idx" ON "sub_hospitals"("districtId");

-- CreateIndex
CREATE INDEX "sub_hospitals_zoneId_idx" ON "sub_hospitals"("zoneId");

-- CreateIndex
CREATE INDEX "sub_hospitals_isActive_idx" ON "sub_hospitals"("isActive");

-- CreateIndex
CREATE INDEX "hospital_staff_hospitalId_idx" ON "hospital_staff"("hospitalId");

-- CreateIndex
CREATE INDEX "hospital_staff_subHospitalId_idx" ON "hospital_staff"("subHospitalId");

-- CreateIndex
CREATE INDEX "hospital_staff_isActive_idx" ON "hospital_staff"("isActive");

-- CreateIndex
CREATE INDEX "children_parentId_idx" ON "children"("parentId");

-- CreateIndex
CREATE INDEX "children_hospitalId_idx" ON "children"("hospitalId");

-- CreateIndex
CREATE INDEX "children_subHospitalId_idx" ON "children"("subHospitalId");

-- CreateIndex
CREATE INDEX "children_isActive_idx" ON "children"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "devices_serialNumber_key" ON "devices"("serialNumber");

-- CreateIndex
CREATE INDEX "devices_status_idx" ON "devices"("status");

-- CreateIndex
CREATE INDEX "devices_deviceType_idx" ON "devices"("deviceType");

-- CreateIndex
CREATE INDEX "devices_hospitalId_idx" ON "devices"("hospitalId");

-- CreateIndex
CREATE INDEX "device_assignments_childId_isActive_idx" ON "device_assignments"("childId", "isActive");

-- CreateIndex
CREATE INDEX "device_assignments_deviceId_isActive_idx" ON "device_assignments"("deviceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "device_assignments_deviceId_childId_isActive_key" ON "device_assignments"("deviceId", "childId", "isActive");

-- CreateIndex
CREATE INDEX "therapy_programs_childId_status_idx" ON "therapy_programs"("childId", "status");

-- CreateIndex
CREATE INDEX "therapy_sessions_childId_sessionDate_idx" ON "therapy_sessions"("childId", "sessionDate");

-- CreateIndex
CREATE INDEX "therapy_sessions_programId_idx" ON "therapy_sessions"("programId");

-- CreateIndex
CREATE INDEX "therapy_sessions_deviceId_idx" ON "therapy_sessions"("deviceId");

-- CreateIndex
CREATE INDEX "movement_logs_sessionId_idx" ON "movement_logs"("sessionId");

-- CreateIndex
CREATE INDEX "movement_logs_deviceId_idx" ON "movement_logs"("deviceId");

-- CreateIndex
CREATE INDEX "movement_logs_movementType_idx" ON "movement_logs"("movementType");

-- CreateIndex
CREATE INDEX "progress_records_childId_recordDate_idx" ON "progress_records"("childId", "recordDate");

-- CreateIndex
CREATE INDEX "progress_records_programId_idx" ON "progress_records"("programId");

-- CreateIndex
CREATE INDEX "appointments_childId_scheduledDate_idx" ON "appointments"("childId", "scheduledDate");

-- CreateIndex
CREATE INDEX "appointments_hospitalId_scheduledDate_idx" ON "appointments"("hospitalId", "scheduledDate");

-- CreateIndex
CREATE INDEX "appointments_parentId_scheduledDate_idx" ON "appointments"("parentId", "scheduledDate");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "provinces_name_key" ON "provinces"("name");

-- CreateIndex
CREATE UNIQUE INDEX "provinces_code_key" ON "provinces"("code");

-- CreateIndex
CREATE UNIQUE INDEX "districts_name_key" ON "districts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "districts_code_key" ON "districts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "zones_name_key" ON "zones"("name");

-- CreateIndex
CREATE UNIQUE INDEX "zones_code_key" ON "zones"("code");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "credential_logs_hospitalId_idx" ON "credential_logs"("hospitalId");

-- CreateIndex
CREATE INDEX "credential_logs_generatedAt_idx" ON "credential_logs"("generatedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_profiles" ADD CONSTRAINT "parent_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_profiles" ADD CONSTRAINT "hospital_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_profiles" ADD CONSTRAINT "hospital_profiles_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_hospitals" ADD CONSTRAINT "sub_hospitals_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_hospitals" ADD CONSTRAINT "sub_hospitals_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_hospitals" ADD CONSTRAINT "sub_hospitals_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_staff" ADD CONSTRAINT "hospital_staff_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_staff" ADD CONSTRAINT "hospital_staff_subHospitalId_fkey" FOREIGN KEY ("subHospitalId") REFERENCES "sub_hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "child_parent_fkey" FOREIGN KEY ("parentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "child_parent_profile_fkey" FOREIGN KEY ("parentId") REFERENCES "parent_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "child_hospital_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "child_subhospital_fkey" FOREIGN KEY ("subHospitalId") REFERENCES "sub_hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_programs" ADD CONSTRAINT "therapy_programs_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_programId_fkey" FOREIGN KEY ("programId") REFERENCES "therapy_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_logs" ADD CONSTRAINT "movement_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "therapy_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_logs" ADD CONSTRAINT "movement_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_records" ADD CONSTRAINT "progress_records_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_records" ADD CONSTRAINT "progress_records_programId_fkey" FOREIGN KEY ("programId") REFERENCES "therapy_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_records" ADD CONSTRAINT "progress_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_subHospitalId_fkey" FOREIGN KEY ("subHospitalId") REFERENCES "sub_hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "hospital_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_logs" ADD CONSTRAINT "credential_logs_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_logs" ADD CONSTRAINT "credential_logs_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
