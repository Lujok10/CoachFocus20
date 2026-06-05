-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietStartHour" INTEGER NOT NULL DEFAULT 22,
    "quietEndHour" INTEGER NOT NULL DEFAULT 7,
    "maxPerDay" INTEGER NOT NULL DEFAULT 2,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "tag" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retries" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationJob_status_scheduledFor_idx" ON "NotificationJob"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "NotificationJob_userId_scheduledFor_idx" ON "NotificationJob"("userId", "scheduledFor");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
