-- Cash drawer "no sale" opens (reason, who, branch, shift).
-- CreateTable
CREATE TABLE "pos_drawer_opens" (
    "id" SERIAL NOT NULL,
    "openNo" TEXT NOT NULL,
    "branchId" INTEGER,
    "shiftId" INTEGER,
    "reason" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_drawer_opens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_drawer_opens_openNo_key" ON "pos_drawer_opens"("openNo");

-- CreateIndex
CREATE INDEX "pos_drawer_opens_shiftId_idx" ON "pos_drawer_opens"("shiftId");

-- CreateIndex
CREATE INDEX "pos_drawer_opens_branchId_createdAt_idx" ON "pos_drawer_opens"("branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "pos_drawer_opens" ADD CONSTRAINT "pos_drawer_opens_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "pos_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
