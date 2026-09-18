CREATE TABLE IF NOT EXISTS "publications" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "shortDescription" TEXT,
  "coverImage" TEXT,
  "price" DOUBLE PRECISION NOT NULL,
  "discountPrice" DOUBLE PRECISION,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER,
  "fileType" TEXT,
  "previewUrl" TEXT,
  "gradeId" TEXT,
  "subjectId" TEXT,
  "mediumId" TEXT,
  "author" TEXT,
  "publisher" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "downloads" INTEGER NOT NULL DEFAULT 0,
  "views" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "hospitalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "publications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "publications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "publications_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "publications_createdById_idx" ON "publications"("createdById");
CREATE INDEX IF NOT EXISTS "publications_hospitalId_idx" ON "publications"("hospitalId");
CREATE INDEX IF NOT EXISTS "publications_status_idx" ON "publications"("status");
CREATE INDEX IF NOT EXISTS "publications_publishedAt_idx" ON "publications"("publishedAt");
CREATE INDEX IF NOT EXISTS "publications_deletedAt_idx" ON "publications"("deletedAt");
