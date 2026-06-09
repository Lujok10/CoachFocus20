-- CreateTable
CREATE TABLE "CalendarWriteJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retries" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarWriteJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarWriteJob_status_createdAt_idx" ON "CalendarWriteJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CalendarWriteJob_userId_status_idx" ON "CalendarWriteJob"("userId", "status");

-- AddForeignKey
ALTER TABLE "CalendarWriteJob" ADD CONSTRAINT "CalendarWriteJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
