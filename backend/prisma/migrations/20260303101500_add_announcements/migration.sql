CREATE TABLE IF NOT EXISTS "announcements" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'GENERAL',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "targetRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "announcements_isActive_idx" ON "announcements"("isActive");
CREATE INDEX IF NOT EXISTS "announcements_type_idx" ON "announcements"("type");
CREATE INDEX IF NOT EXISTS "announcements_priority_idx" ON "announcements"("priority");
CREATE INDEX IF NOT EXISTS "announcements_publishedAt_idx" ON "announcements"("publishedAt");
CREATE INDEX IF NOT EXISTS "announcements_expiresAt_idx" ON "announcements"("expiresAt");
CREATE INDEX IF NOT EXISTS "announcements_deletedAt_idx" ON "announcements"("deletedAt");
