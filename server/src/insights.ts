import { prisma } from "./db";

function startOfWeek() {
  const now = new Date();
  const start = new Date(now);

  start.setDate(now.getDate() - now.getDay());
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
  const weekStart = startOfWeek();

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
    (item) => item.needleMover === "yes"
  ).length;

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
    const category =
      item.focusBlock?.leverCategory ?? "admin";

    const current = leverScores.get(category) ?? 0;

    let score = 0;

    if (
      item.result === "crushed" &&
      item.needleMover === "yes"
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
    (task) => task.startIso && task.startIso >= day && task.startIso < nextDay
  );

  const protectedMinutes =
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

  const completedMinutes =
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
    protectedMinutes,
    completedMinutes,
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
    },
    topLevers,
    timeLeaks,
    trend,
    shareText: `This week I protected ${protectedMinutes} minutes for high-leverage work and completed ${completedMinutes} minutes. Completion rate: ${completionRate}%.`,
  };
}