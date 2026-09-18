CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'GENERAL',
  "status" TEXT NOT NULL DEFAULT 'UNREAD',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "data" JSONB,
  "link" TEXT,
  "metadata" JSONB,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notifications"("status");
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications"("type");
CREATE INDEX IF NOT EXISTS "notifications_sentAt_idx" ON "notifications"("sentAt");
CREATE INDEX IF NOT EXISTS "notifications_deletedAt_idx" ON "notifications"("deletedAt");
