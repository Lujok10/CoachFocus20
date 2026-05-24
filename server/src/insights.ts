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

  const [blocks, feedback, tasks] = await Promise.all([
    prisma.focusBlock.findMany({
      where: {
        userId,
        startIso: {
          gte: weekStart,
          lte: now,
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

    prisma.task.findMany({
      where: {
        userId,
        startIso: {
          gte: weekStart,
          lte: now,
        },
      },
    }),
  ]);

  const completedBlocks = blocks.filter(
    (block) => block.status === "completed"
  );

  const missedBlocks = blocks.filter(
    (block) => block.status === "missed"
  );

  const scheduledTasks = tasks.filter(
    (task) => task.startIso && task.endIso
  );

  const completedTasks = tasks.filter(
    (task) => task.status === "completed"
  );

  const protectedBlockMinutes = blocks.reduce(
    (total, block) =>
      total + minutesBetween(block.startIso, block.endIso),
    0
  );

  const taskProtectedMinutes = scheduledTasks.reduce(
    (total, task) =>
      total + minutesBetween(task.startIso, task.endIso),
    0
  );

  const protectedMinutes =
    protectedBlockMinutes + taskProtectedMinutes;

  const completedBlockMinutes = completedBlocks.reduce(
    (total, block) =>
      total + minutesBetween(block.startIso, block.endIso),
    0
  );

  const completedTaskMinutes = completedTasks.reduce(
    (total, task) =>
      total + minutesBetween(task.startIso, task.endIso),
    0
  );

  const completedMinutes =
    completedBlockMinutes + completedTaskMinutes;

  const needleMoverFeedback = feedback.filter(
    (item) => item.needleMover === "yes"
  );

  const totalProtectedItems =
    blocks.length + scheduledTasks.length;

  const totalCompletedItems =
    completedBlocks.length + completedTasks.length;

  const completionRate =
    totalProtectedItems === 0
      ? 0
      : Math.round(
          (totalCompletedItems / totalProtectedItems) * 100
        );

  const leverScores = new Map<string, number>();

  for (const item of feedback) {
    const category =
      item.focusBlock?.leverCategory ?? "admin";

    const current = leverScores.get(category) ?? 0;

    let delta = 0;

    if (
      item.result === "crushed" &&
      item.needleMover === "yes"
    ) {
      delta = 3;
    } else if (item.result === "crushed") {
      delta = 2;
    } else if (item.result === "meh") {
      delta = 1;
    } else if (item.result === "missed") {
      delta = -1;
    }

    leverScores.set(category, current + delta);
  }

  for (const task of scheduledTasks) {
    const category = task.category ?? "admin";
    const current = leverScores.get(category) ?? 0;

    leverScores.set(
      category,
      current + (task.status === "completed" ? 2 : 1)
    );
  }

  const topLevers = [...leverScores.entries()]
    .map(([category, score]) => ({
      category,
      score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const missedTaskLeaks = tasks
    .filter((task) => task.status === "missed")
    .slice(0, 3)
    .map((task) => ({
      title: task.title,
      category: task.category ?? "admin",
      startIso: task.startIso,
      reason: "Missed scheduled task",
    }));

  const missedBlockLeaks = missedBlocks
    .slice(0, 3)
    .map((block) => ({
      title: block.title,
      category: block.leverCategory,
      startIso: block.startIso,
      reason: "Missed protected block",
    }));

  const timeLeaks = [
    ...missedBlockLeaks,
    ...missedTaskLeaks,
  ].slice(0, 3);

  return {
    weekStart,
    generatedAt: now,
    summary: {
      protectedMinutes,
      completedMinutes,
      completionRate,
      needleMoverWins: needleMoverFeedback.length,
      totalBlocks: totalProtectedItems,
      completedBlocks: totalCompletedItems,
      missedBlocks:
        missedBlocks.length +
        tasks.filter((task) => task.status === "missed").length,
    },
    topLevers,
    timeLeaks,
    shareText: `This week I protected ${protectedMinutes} minutes for high-leverage work and completed ${completedMinutes} minutes. Completion rate: ${completionRate}%.`,
  };
}