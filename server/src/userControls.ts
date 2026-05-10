import { prisma, DEMO_USER_ID, ensureDemoUser } from "./db";

export async function disconnectGoogleCalendar() {
  await ensureDemoUser();

  await prisma.googleCalendarConnection.deleteMany({
    where: { userId: DEMO_USER_ID },
  });

  await prisma.user.update({
    where: { id: DEMO_USER_ID },
    data: {
      provider: "local",
      calendarConnected: false,
      calendarPermission: "none",
    },
  });

  return {
    ok: true,
    calendarConnected: false,
  };
}

export async function resetPatternProfile() {
  await ensureDemoUser();

  await prisma.patternProfile.deleteMany({
    where: { userId: DEMO_USER_ID },
  });

  const profile = await prisma.patternProfile.create({
    data: {
      userId: DEMO_USER_ID,
      bestWindows: [
        { start: "09:30", end: "10:30", score: 0.92 },
        { start: "11:00", end: "12:00", score: 0.84 },
        { start: "14:00", end: "15:00", score: 0.68 },
      ],
      leverRankings: [
        { category: "income", score: 0.93 },
        { category: "learning", score: 0.78 },
        { category: "admin", score: 0.62 },
        { category: "health", score: 0.58 },
        { category: "family", score: 0.55 },
        { category: "creative", score: 0.51 },
      ],
      frictionSignals: {
        resetAt: new Date().toISOString(),
      },
    },
  });

  return {
    ok: true,
    profile,
  };
}

export async function clearUserHistory() {
  await ensureDemoUser();

  await prisma.$transaction([
    prisma.feedback.deleteMany({
      where: { userId: DEMO_USER_ID },
    }),
    prisma.analyticsEvent.deleteMany({
      where: { userId: DEMO_USER_ID },
    }),
    prisma.actionsLog.deleteMany({
      where: { userId: DEMO_USER_ID },
    }),
    prisma.calendarWriteQueue.deleteMany({
      where: { userId: DEMO_USER_ID },
    }),
    prisma.task.deleteMany({
      where: { userId: DEMO_USER_ID },
    }),
    prisma.focusBlock.deleteMany({
      where: { userId: DEMO_USER_ID },
    }),
  ]);

  await prisma.user.update({
    where: { id: DEMO_USER_ID },
    data: {
      completedFirstLever: false,
    },
  });

  return {
    ok: true,
    message: "History cleared. User settings and calendar connection were preserved.",
  };
}
