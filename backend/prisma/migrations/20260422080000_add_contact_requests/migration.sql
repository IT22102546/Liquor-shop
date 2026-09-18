-- CreateTable
CREATE TABLE "contact_requests" (
    "id" SERIAL NOT NULL,
    "displayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "interests" TEXT NOT NULL DEFAULT '',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_requests_displayId_key" ON "contact_requests"("displayId");

-- CreateIndex
CREATE INDEX "contact_requests_status_idx" ON "contact_requests"("status");
