import { prisma, ensureUser } from "./db";

const DEFAULT_WINDOWS = [
  { start: "09:30", end: "10:30", score: 0.8 },
  { start: "11:00", end: "12:00", score: 0.7 },
  { start: "14:00", end: "15:00", score: 0.6 },
];

const DEFAULT_LEVERS = [
  { category: "income", score: 0.7 },
  { category: "learning", score: 0.65 },
  { category: "admin", score: 0.6 },
  { category: "health", score: 0.55 },
  { category: "family", score: 0.5 },
  { category: "creative", score: 0.5 },
];

function clamp(value: number) {
  return Math.max(0.05, Math.min(0.99, value));
}

function windowForHour(hour: number) {
  if (hour < 10) return { key: "early_morning", start: "08:30", end: "10:00" };
  if (hour < 12) return { key: "late_morning", start: "10:00", end: "12:00" };
  if (hour < 15) return { key: "early_afternoon", start: "13:00", end: "15:00" };
  if (hour < 18) return { key: "late_afternoon", start: "15:00", end: "18:00" };
  return { key: "evening", start: "18:00", end: "20:00" };
}

function statusScore(status: string) {
  if (status === "completed") return 2;
  if (status === "started") return 1;
  if (status === "scheduled") return 0.5;
  if (status === "missed") return -1.5;
  if (status === "cancelled") return -0.5;
  return 0;
}

function feedbackScore(result?: string, needleMover?: string) {
  if (result === "crushed" && needleMover === "yes") return 3;
  if (result === "crushed") return 2;
  if (result === "meh" && needleMover === "yes") return 1.5;
  if (result === "meh") return 0.5;
  if (result === "missed") return -2;
  return 0;
}

export async function ensurePatternProfile(userId: string) {
  await ensureUser(userId);

  return prisma.patternProfile.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      bestWindows: DEFAULT_WINDOWS,
      leverRankings: DEFAULT_LEVERS,
      frictionSignals: {
        initializedAt: new Date().toISOString(),
        meetingsPeakConflict: 0,
        contextSwitching: 0,
        missedRate: 0,
      },
    },
  });
}

export async function rebuildPatternProfile(userId: string) {
  await ensureUser(userId);

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [blocks, tasks, feedback] = await Promise.all([
    prisma.focusBlock.findMany({
      where: {
        userId,
        startIso: { gte: since },
      },
      include: {
        feedback: true,
      },
    }),

    prisma.task.findMany({
      where: {
        userId,
        startIso: { gte: since },
      },
    }),

    prisma.feedback.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      include: {
        focusBlock: true,
      },
    }),
  ]);

  const categoryScores = new Map<string, { score: number; count: number }>();
  const windowScores = new Map<string, { start: string; end: string; score: number; count: number }>();

  for (const block of blocks) {
    const category = block.leverCategory ?? "admin";
    const hour = block.startIso.getHours();
    const window = windowForHour(hour);

    const blockFeedbackScore = block.feedback.reduce(
      (sum, item) => sum + feedbackScore(item.result, item.needleMover),
      0
    );

    const score = statusScore(block.status) + blockFeedbackScore;

    const existingCategory = categoryScores.get(category) ?? { score: 0, count: 0 };
    categoryScores.set(category, {
      score: existingCategory.score + score,
      count: existingCategory.count + 1,
    });

    const existingWindow = windowScores.get(window.key) ?? {
      start: window.start,
      end: window.end,
      score: 0,
      count: 0,
    };

    windowScores.set(window.key, {
      ...existingWindow,
      score: existingWindow.score + score,
      count: existingWindow.count + 1,
    });
  }

  for (const task of tasks) {
    if (!task.startIso) continue;

    const category = task.category ?? "admin";
    const hour = task.startIso.getHours();
    const window = windowForHour(hour);
    const score = statusScore(task.status);

    const existingCategory = categoryScores.get(category) ?? { score: 0, count: 0 };
    categoryScores.set(category, {
      score: existingCategory.score + score,
      count: existingCategory.count + 1,
    });

    const existingWindow = windowScores.get(window.key) ?? {
      start: window.start,
      end: window.end,
      score: 0,
      count: 0,
    };

    windowScores.set(window.key, {
      ...existingWindow,
      score: existingWindow.score + score,
      count: existingWindow.count + 1,
    });
  }

  for (const item of feedback) {
    const category = item.focusBlock?.leverCategory ?? "admin";
    const score = feedbackScore(item.result, item.needleMover);

    const existingCategory = categoryScores.get(category) ?? { score: 0, count: 0 };
    categoryScores.set(category, {
      score: existingCategory.score + score,
      count: existingCategory.count + 1,
    });
  }

  const leverRankings =
    categoryScores.size > 0
      ? [...categoryScores.entries()]
          .map(([category, value]) => ({
            category,
            score: clamp(0.5 + value.score / Math.max(10, value.count * 4)),
          }))
          .sort((a, b) => b.score - a.score)
      : DEFAULT_LEVERS;

  const bestWindows =
    windowScores.size > 0
      ? [...windowScores.values()]
          .map((window) => ({
            start: window.start,
            end: window.end,
            score: clamp(0.5 + window.score / Math.max(10, window.count * 4)),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
      : DEFAULT_WINDOWS;

  const totalItems = blocks.length + tasks.length;
  const missedItems =
    blocks.filter((block) => block.status === "missed").length +
    tasks.filter((task) => task.status === "missed").length;

  const completedItems =
    blocks.filter((block) => block.status === "completed").length +
    tasks.filter((task) => task.status === "completed").length;

  const eveningItems =
    blocks.filter((block) => block.startIso.getHours() >= 18).length +
    tasks.filter((task) => task.startIso && task.startIso.getHours() >= 18).length;

  const frictionSignals = {
    missedRate: totalItems === 0 ? 0 : missedItems / totalItems,
    completionRate: totalItems === 0 ? 0 : completedItems / totalItems,
    lateStartRate: totalItems === 0 ? 0 : eveningItems / totalItems,
    contextSwitching: totalItems > 20 ? 0.7 : totalItems > 10 ? 0.4 : 0.15,
    feedbackCount: feedback.length,
    lastUpdatedIso: new Date().toISOString(),
  };

  return prisma.patternProfile.upsert({
    where: { userId },
    update: {
      bestWindows,
      leverRankings,
      frictionSignals,
    },
    create: {
      userId,
      bestWindows,
      leverRankings,
      frictionSignals,
    },
  });
}