-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'calendar_write_queued';

-- CreateTable
CREATE TABLE "CalendarWriteQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarWriteQueue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CalendarWriteQueue" ADD CONSTRAINT "CalendarWriteQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
