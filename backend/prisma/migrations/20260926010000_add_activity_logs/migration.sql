-- Append-only activity log: sign-ins and every change saved through the POS API.
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");
CREATE INDEX "activity_logs_actorId_idx" ON "activity_logs"("actorId");
CREATE INDEX "activity_logs_category_idx" ON "activity_logs"("category");
