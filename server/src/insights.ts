import { prisma } from "./db";

function rollingSevenDaysStart() {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);

  return start;
}

function minutesBetween(start?: Date | null, end?: Date | null) {
  if (!start || !end) return 0;

  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 60000)
  );
}

export async function getWeeklyInsights(userId: string) {
  const now = new Date();
  const weekStart = rollingSevenDaysStart();

  const [blocks, tasks, feedback] = await Promise.all([
    prisma.focusBlock.findMany({
      where: {
        userId,
        startIso: {
          gte: weekStart,
          lte: now,
        },
        status: {
          not: "cancelled",
        },
      },
    }),

    prisma.task.findMany({
      where: {
        userId,
        startIso: {
          gte: weekStart,
          lte: now,
        },
        status: {
          not: "unscheduled",
        },
      },
    }),

    prisma.feedback.findMany({
      where: {
        userId,
        createdAt: {
          gte: weekStart,
          lte: now,
        },
      },
      include: {
        focusBlock: true,
      },
    }),
  ]);

  const completedBlocks = blocks.filter(
    (block) => block.status === "completed"
  );

  const missedBlocks = blocks.filter(
    (block) => block.status === "missed"
  );

  const completedTasks = tasks.filter(
    (task) => task.status === "completed"
  );

  const missedTasks = tasks.filter(
    (task) => task.status === "missed"
  );

  const protectedMinutes =
    blocks.reduce(
      (total, block) =>
        total + minutesBetween(block.startIso, block.endIso),
      0
    ) +
    tasks.reduce(
      (total, task) =>
        total + minutesBetween(task.startIso, task.endIso),
      0
    );

  const completedMinutes =
    completedBlocks.reduce(
      (total, block) =>
        total + minutesBetween(block.startIso, block.endIso),
      0
    ) +
    completedTasks.reduce(
      (total, task) =>
        total + minutesBetween(task.startIso, task.endIso),
      0
    );

  const totalItems = blocks.length + tasks.length;

  const completedItems =
    completedBlocks.length + completedTasks.length;

  const completionRate =
    totalItems === 0
      ? 0
      : Math.round((completedItems / totalItems) * 100);

  const needleMoverWins = feedback.filter(
    (item) =>
      item.needleMover === "yes" ||
      item.needleMover === "somewhat"
  ).length;

  const protectedMinutesScore = Math.min(
    20,
    Math.round(protectedMinutes / 15)
  );

  const completionRateScore = Math.round(completionRate * 0.4);

  const needleMoverScore = Math.min(
    20,
    needleMoverWins * 4
  );

  const completedMinutesScore = Math.min(
    20,
    Math.round(completedMinutes / 12)
  );

  const focusHealthScore = Math.min(
    100,
    completionRateScore +
      protectedMinutesScore +
      needleMoverScore +
      completedMinutesScore
  );

  const effectivenessBreakdown = [
    {
      label: "Completion rate",
      value: `${completionRate}%`,
      points: completionRateScore,
    },
    {
      label: "Protected focus time",
      value: `${protectedMinutes} min`,
      points: protectedMinutesScore,
    },
    {
      label: "Completed focus time",
      value: `${completedMinutes} min`,
      points: completedMinutesScore,
    },
    {
      label: "Needle movers",
      value: `${needleMoverWins} wins`,
      points: needleMoverScore,
    },
  ];

  const leverScores = new Map<string, number>();

  for (const block of blocks) {
    const category = block.leverCategory ?? "admin";
    const current = leverScores.get(category) ?? 0;

    let score = 1;

    if (block.status === "completed") score = 3;
    if (block.status === "missed") score = -1;

    leverScores.set(category, current + score);
  }

  for (const task of tasks) {
    const category = task.category ?? "admin";
    const current = leverScores.get(category) ?? 0;

    let score = 1;

    if (task.status === "completed") score = 2;
    if (task.status === "missed") score = -1;

    leverScores.set(category, current + score);
  }

  for (const item of feedback) {
    const category = item.focusBlock?.leverCategory ?? "admin";
    const current = leverScores.get(category) ?? 0;

    let score = 0;

    if (
      item.result === "crushed" &&
      (item.needleMover === "yes" ||
        item.needleMover === "somewhat")
    ) {
      score = 3;
    } else if (item.result === "crushed") {
      score = 2;
    } else if (item.result === "meh") {
      score = 1;
    } else if (item.result === "missed") {
      score = -1;
    }

    leverScores.set(category, current + score);
  }

  const topLevers = [...leverScores.entries()]
    .map(([category, score]) => ({
      category,
      score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const timeLeaks = [
    ...missedBlocks.map((block) => ({
      title: block.title,
      category: block.leverCategory,
      startIso: block.startIso,
      reason: "Missed protected block",
    })),

    ...missedTasks.map((task) => ({
      title: task.title,
      category: task.category ?? "admin",
      startIso: task.startIso,
      reason: "Missed scheduled task",
    })),
  ].slice(0, 3);

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const trend = Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);

    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    const dayBlocks = blocks.filter(
      (block) => block.startIso >= day && block.startIso < nextDay
    );

    const dayTasks = tasks.filter(
      (task) =>
        task.startIso &&
        task.startIso >= day &&
        task.startIso < nextDay
    );

    const dayProtectedMinutes =
      dayBlocks.reduce(
        (total, block) =>
          total + minutesBetween(block.startIso, block.endIso),
        0
      ) +
      dayTasks.reduce(
        (total, task) =>
          total + minutesBetween(task.startIso, task.endIso),
        0
      );

    const dayCompletedMinutes =
      dayBlocks
        .filter((block) => block.status === "completed")
        .reduce(
          (total, block) =>
            total + minutesBetween(block.startIso, block.endIso),
          0
        ) +
      dayTasks
        .filter((task) => task.status === "completed")
        .reduce(
          (total, task) =>
            total + minutesBetween(task.startIso, task.endIso),
          0
        );

    return {
      day: dayLabels[day.getDay()],
      protectedMinutes: dayProtectedMinutes,
      completedMinutes: dayCompletedMinutes,
    };
  });

  return {
    weekStart,
    generatedAt: now,
    summary: {
      protectedMinutes,
      completedMinutes,
      completionRate,
      needleMoverWins,
      totalBlocks: totalItems,
      completedBlocks: completedItems,
      missedBlocks: missedBlocks.length + missedTasks.length,
      focusHealthScore,
      effectivenessBreakdown,
    },
    topLevers,
    timeLeaks,
    trend,
    shareText:
      completionRate >= 80
        ? `Excellent week. You protected ${protectedMinutes} minutes and completed ${completedMinutes} minutes with an ${completionRate}% completion rate. Your strongest lever was ${
            topLevers[0]?.category ?? "focus"
          }.`
        : completionRate >= 60
          ? `Strong week. You protected ${protectedMinutes} minutes and completed ${completedMinutes} minutes. Your next opportunity is improving completion from ${completionRate}% to 80%.`
          : `Focus system needs attention. You protected ${protectedMinutes} minutes but completed ${completedMinutes} minutes. Prioritize fewer, higher-impact blocks next week.`,
  };
}