-- Migration: add_physio_tables
-- Adds availability columns to hospital_staff, creates physiotherapy_assignments
-- and physio_unavailable_dates tables.

-- ============================================================
-- 1. Add availability columns to hospital_staff
-- ============================================================
ALTER TABLE "hospital_staff"
  ADD COLUMN IF NOT EXISTS "availabilityStatus"    TEXT DEFAULT 'AVAILABLE',
  ADD COLUMN IF NOT EXISTS "availabilityNote"      TEXT,
  ADD COLUMN IF NOT EXISTS "availabilityUpdatedAt" TIMESTAMP(3);

-- ============================================================
-- 2. Create physiotherapy_assignments table
-- ============================================================
CREATE TABLE IF NOT EXISTS "physiotherapy_assignments" (
  "id"                  TEXT NOT NULL,
  "hospitalId"          TEXT,
  "physiotherapistId"   TEXT,
  "childId"             TEXT NOT NULL,
  "title"               TEXT NOT NULL,
  "description"         TEXT,
  "assignmentPdf"       TEXT,
  "assignmentPdfName"   TEXT,
  "status"              TEXT NOT NULL DEFAULT 'ACTIVE',
  "dueDate"             TIMESTAMP(3),
  "createdById"         TEXT NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "physiotherapy_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "physiotherapy_assignments_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "physiotherapy_assignments_physiotherapistId_fkey"
    FOREIGN KEY ("physiotherapistId") REFERENCES "hospital_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "physiotherapy_assignments_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "physiotherapy_assignments_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "physiotherapy_assignments_hospitalId_idx"        ON "physiotherapy_assignments"("hospitalId");
CREATE INDEX IF NOT EXISTS "physiotherapy_assignments_physiotherapistId_idx" ON "physiotherapy_assignments"("physiotherapistId");
CREATE INDEX IF NOT EXISTS "physiotherapy_assignments_childId_idx"           ON "physiotherapy_assignments"("childId");
CREATE INDEX IF NOT EXISTS "physiotherapy_assignments_status_idx"            ON "physiotherapy_assignments"("status");
CREATE INDEX IF NOT EXISTS "physiotherapy_assignments_createdAt_idx"         ON "physiotherapy_assignments"("createdAt");

-- ============================================================
-- 3. Create physio_unavailable_dates table
-- ============================================================
CREATE TABLE IF NOT EXISTS "physio_unavailable_dates" (
  "id"        TEXT NOT NULL,
  "staffId"   TEXT NOT NULL,
  "date"      DATE NOT NULL,
  "reason"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "physio_unavailable_dates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "physio_unavailable_dates_staffId_date_key" UNIQUE ("staffId", "date"),
  CONSTRAINT "physio_unavailable_dates_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "hospital_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "physio_unavailable_dates_staffId_idx" ON "physio_unavailable_dates"("staffId");
CREATE INDEX IF NOT EXISTS "physio_unavailable_dates_date_idx"    ON "physio_unavailable_dates"("date");
