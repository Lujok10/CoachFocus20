-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionType" ADD VALUE 'focus_block_started';
ALTER TYPE "ActionType" ADD VALUE 'notification_sent';
ALTER TYPE "ActionType" ADD VALUE 'calendar_permission_changed';
ALTER TYPE "ActionType" ADD VALUE 'google_oauth_connected';
ALTER TYPE "ActionType" ADD VALUE 'schedule_task';
ALTER TYPE "ActionType" ADD VALUE 'undo_task_schedule';
ALTER TYPE "ActionType" ADD VALUE 'flex_shift_previewed';
ALTER TYPE "ActionType" ADD VALUE 'flex_event_shifted';

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'admin',
    "notes" TEXT,
    "dueDateIso" TIMESTAMP(3),
    "startIso" TIMESTAMP(3),
    "endIso" TIMESTAMP(3),
    "provider" TEXT NOT NULL DEFAULT 'local',
    "providerEventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unscheduled',
    "protectAsFocus" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
