import { prisma, DEMO_USER_ID, ensureDemoUser } from "./db";

function startOfWeek() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function getWeeklyInsights() {
  await ensureDemoUser();

  const weekStart = startOfWeek();
  const now = new Date();

  const blocks = await prisma.focusBlock.findMany({
    where: {
      userId: DEMO_USER_ID,
      startIso: {
        gte: weekStart,
        lte: now,
      },
    },
  });

  const feedback = await prisma.feedback.findMany({
    where: {
      userId: DEMO_USER_ID,
      createdAt: {
        gte: weekStart,
        lte: now,
      },
    },
    include: {
      focusBlock: true,
    },
  });

  const completedBlocks = blocks.filter((b) => b.status === "completed");
  const missedBlocks = blocks.filter((b) => b.status === "missed");

  const protectedMinutes = blocks.reduce((total, block) => {
    return total + Math.round((block.endIso.getTime() - block.startIso.getTime()) / 60000);
  }, 0);

  const completedMinutes = completedBlocks.reduce((total, block) => {
    return total + Math.round((block.endIso.getTime() - block.startIso.getTime()) / 60000);
  }, 0);

  const needleMoverFeedback = feedback.filter((f) => f.needleMover === "yes");
  const completionRate =
    blocks.length === 0 ? 0 : Math.round((completedBlocks.length / blocks.length) * 100);

  const leverScores = new Map<string, number>();

  for (const item of feedback) {
    const category = item.focusBlock?.leverCategory ?? "admin";
    const current = leverScores.get(category) ?? 0;

    let delta = 0;
    if (item.result === "crushed" && item.needleMover === "yes") delta = 3;
    else if (item.result === "crushed") delta = 2;
    else if (item.result === "meh") delta = 1;
    else if (item.result === "missed") delta = -1;

    leverScores.set(category, current + delta);
  }

  const topLevers = [...leverScores.entries()]
    .map(([category, score]) => ({ category, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const timeLeaks = missedBlocks.slice(0, 3).map((block) => ({
    title: block.title,
    category: block.leverCategory,
    startIso: block.startIso,
    reason: "Missed protected block",
  }));

  return {
    weekStart,
    generatedAt: now,
    summary: {
      protectedMinutes,
      completedMinutes,
      completionRate,
      needleMoverWins: needleMoverFeedback.length,
      totalBlocks: blocks.length,
      completedBlocks: completedBlocks.length,
      missedBlocks: missedBlocks.length,
    },
    topLevers,
    timeLeaks,
    shareText: `This week I protected ${protectedMinutes} minutes for high-leverage work and completed ${completedMinutes} minutes. Completion rate: ${completionRate}%.`,
  };
}
