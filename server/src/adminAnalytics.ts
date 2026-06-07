import { prisma } from "./db";

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getAdminAnalytics() {
  const since30 = daysAgo(30);
  const since14 = daysAgo(14);
  const since7 = daysAgo(7);

  const [
    users,
    analytics,
    focusBlocks,
    tasks,
    feedback,
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        createdAt: {
          gte: since30,
        },
      },
      select: {
        id: true,
        createdAt: true,
        calendarConnected: true,
        completedFirstLever: true,
        notificationsEnabled: true,
      },
    }),

    prisma.analyticsEvent.findMany({
      where: {
        createdAt: {
          gte: since30,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),

    prisma.focusBlock.findMany({
      where: {
        startIso: {
          gte: since30,
        },
      },
    }),

    prisma.task.findMany({
      where: {
        createdAt: {
          gte: since30,
        },
      },
    }),

    prisma.feedback.findMany({
        where: {
            createdAt: {
            gte: since30,
            },
        },
        include: {
            focusBlock: true,
        },
        })
  ]);

  const userIds = new Set(users.map((user) => user.id));

  const usersWithWakePlan = new Set(
    analytics
      .filter((event) => event.name === "wake_plan_refreshed")
      .map((event) => event.userId)
  );

  const usersStartedBlock = new Set(
    analytics
      .filter((event) => event.name === "block_started")
      .map((event) => event.userId)
  );

  const usersCompletedBlock = new Set(
    focusBlocks
      .filter((block) => block.status === "completed")
      .map((block) => block.userId)
  );

  const usersCheckedIn = new Set(
    analytics
      .filter((event) => event.name === "voice_checkin_used")
      .map((event) => event.userId)
  );

  const usersConnectedCalendar = new Set(
    users.filter((user) => user.calendarConnected).map((user) => user.id)
  );

  const usersEnabledNotifications = new Set(
    users.filter((user) => user.notificationsEnabled).map((user) => user.id)
  );

  const funnel = [
    {
      step: "Signed up",
      count: userIds.size,
    },
    {
      step: "Generated WakePlan",
      count: usersWithWakePlan.size,
    },
    {
      step: "Started block",
      count: usersStartedBlock.size,
    },
    {
      step: "Completed block",
      count: usersCompletedBlock.size,
    },
    {
      step: "Checked in",
      count: usersCheckedIn.size,
    },
    {
      step: "Connected calendar",
      count: usersConnectedCalendar.size,
    },
    {
      step: "Enabled notifications",
      count: usersEnabledNotifications.size,
    },
  ];

  const activeLast7 = new Set(
    analytics
      .filter((event) => event.createdAt >= since7)
      .map((event) => event.userId)
  );

  const activeLast14 = new Set(
    analytics
      .filter((event) => event.createdAt >= since14)
      .map((event) => event.userId)
  );

  const retention = {
    activeUsers7d: activeLast7.size,
    activeUsers14d: activeLast14.size,
    newUsers30d: users.length,
    sevenDayRetention:
      users.length === 0
        ? 0
        : Math.round((activeLast7.size / users.length) * 100),
    fourteenDayRetention:
      users.length === 0
        ? 0
        : Math.round((activeLast14.size / users.length) * 100),
  };

  const completionTrend = Array.from({ length: 14 }).map((_, index) => {
    const day = daysAgo(13 - index);
    const key = dayKey(day);

    const dayBlocks = focusBlocks.filter(
      (block) => dayKey(block.startIso) === key
    );

    const completed = dayBlocks.filter(
      (block) => block.status === "completed"
    ).length;

    const missed = dayBlocks.filter(
      (block) => block.status === "missed"
    ).length;

    return {
      day: key.slice(5),
      scheduled: dayBlocks.length,
      completed,
      missed,
      completionRate:
        dayBlocks.length === 0
          ? 0
          : Math.round((completed / dayBlocks.length) * 100),
    };
  });

  const categoryMap = new Map<string, { category: string; count: number; score: number }>();

  for (const item of feedback) {
    const category = item.focusBlock?.leverCategory ?? "admin";
    const current =
      categoryMap.get(category) ?? {
        category,
        count: 0,
        score: 0,
      };

    let delta = 0;

    if (item.result === "crushed" && item.needleMover === "yes") {
      delta = 3;
    } else if (item.result === "crushed") {
      delta = 2;
    } else if (item.result === "meh") {
      delta = 1;
    } else if (item.result === "missed") {
      delta = -1;
    }

    current.count += 1;
    current.score += delta;

    categoryMap.set(category, current);
  }

  const topLeverageCategories = [...categoryMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const totals = {
    users30d: users.length,
    analyticsEvents30d: analytics.length,
    focusBlocks30d: focusBlocks.length,
    tasks30d: tasks.length,
    feedback30d: feedback.length,
    completedBlocks30d: focusBlocks.filter(
      (block) => block.status === "completed"
    ).length,
    missedBlocks30d: focusBlocks.filter(
      (block) => block.status === "missed"
    ).length,
  };

  return {
    generatedAt: new Date(),
    totals,
    funnel,
    retention,
    completionTrend,
    topLeverageCategories,
  };
}