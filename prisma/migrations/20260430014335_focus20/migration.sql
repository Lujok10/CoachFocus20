-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('google', 'microsoft', 'local');

-- CreateEnum
CREATE TYPE "CalendarPermission" AS ENUM ('write', 'read_only', 'none');

-- CreateEnum
CREATE TYPE "FocusBlockStatus" AS ENUM ('scheduled', 'started', 'completed', 'missed', 'cancelled');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('applied', 'undone', 'failed');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('reserve_block', 'move_flex_event', 'voice_checkin', 'create_suggested_block', 'update_focus_block');

-- CreateEnum
CREATE TYPE "LeverCategory" AS ENUM ('income', 'health', 'family', 'admin', 'learning', 'creative');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "provider" "Provider" NOT NULL DEFAULT 'local',
    "calendarConnected" BOOLEAN NOT NULL DEFAULT false,
    "calendarPermission" "CalendarPermission" NOT NULL DEFAULT 'none',
    "protectEnabled" BOOLEAN NOT NULL DEFAULT true,
    "flexShiftEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxMovesPerDay" INTEGER NOT NULL DEFAULT 1,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "completedFirstLever" BOOLEAN NOT NULL DEFAULT false,
    "buffersMinutes" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scope" TEXT,
    "expiryDate" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "providerEventId" TEXT,
    "title" TEXT NOT NULL,
    "startIso" TIMESTAMP(3) NOT NULL,
    "endIso" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'ai',
    "status" "FocusBlockStatus" NOT NULL DEFAULT 'scheduled',
    "leverCategory" "LeverCategory" NOT NULL,
    "predictedImpact" INTEGER NOT NULL DEFAULT 5,
    "confidence" INTEGER NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "focusBlockId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "needleMover" TEXT NOT NULL,
    "noteText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionsLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "undoPayload" JSONB NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'applied',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bestWindows" JSONB NOT NULL,
    "leverRankings" JSONB NOT NULL,
    "frictionSignals" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatternProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarConnection_userId_key" ON "GoogleCalendarConnection"("userId");

-- CreateIndex
CREATE INDEX "FocusBlock_userId_startIso_idx" ON "FocusBlock"("userId", "startIso");

-- CreateIndex
CREATE UNIQUE INDEX "PatternProfile_userId_key" ON "PatternProfile"("userId");

-- AddForeignKey
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusBlock" ADD CONSTRAINT "FocusBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_focusBlockId_fkey" FOREIGN KEY ("focusBlockId") REFERENCES "FocusBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionsLog" ADD CONSTRAINT "ActionsLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternProfile" ADD CONSTRAINT "PatternProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
