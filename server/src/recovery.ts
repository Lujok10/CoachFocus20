import { prisma, ensureUser } from "./db";
import { chooseSmartSlot } from "./scheduler";
import { rebuildPatternProfile } from "./patterns";
import { trackAnalytics } from "./analytics";

type RecoverySuggestion = {
  missedItemId: string;
  missedItemType: "focus_block" | "task";
  title: string;
  category: string;
  missedStartIso: string;
  suggestedStartIso: string;
  suggestedEndIso: string;
  schedulerScore: number;
  reasons: string[];
  burnoutRisk: "low" | "medium" | "high";
  burnoutSignals: string[];
};

function sinceDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function detectBurnoutRisk(input: {
  missedLast7: number;
  completedLast7: number;
  totalLast7: number;
}) {
  const signals: string[] = [];

  const completionRate =
    input.totalLast7 === 0 ? 1 : input.completedLast7 / input.totalLast7;

  if (input.missedLast7 >= 3) {
    signals.push("Several protected blocks/tasks were missed this week.");
  }

  if (completionRate < 0.4 && input.totalLast7 >= 3) {
    signals.push("Completion rate is low across recent scheduled work.");
  }

  if (input.missedLast7 >= 5 || completionRate < 0.25) {
    return {
      risk: "high" as const,
      signals,
    };
  }

  if (input.missedLast7 >= 2 || completionRate < 0.5) {
    return {
      risk: "medium" as const,
      signals,
    };
  }

  return {
    risk: "low" as const,
    signals,
  };
}

export async function getRecoverySuggestion(
  userId: string
): Promise<RecoverySuggestion | null> {
  await ensureUser(userId);

  const last7 = sinceDays(7);

  const [missedBlocks, missedTasks, recentBlocks, recentTasks] =
    await Promise.all([
      prisma.focusBlock.findMany({
        where: {
          userId,
          status: "missed",
          startIso: {
            gte: last7,
          },
        },
        orderBy: {
          startIso: "desc",
        },
        take: 5,
      }),

      prisma.task.findMany({
        where: {
          userId,
          status: "missed",
          startIso: {
            gte: last7,
          },
        },
        orderBy: {
          startIso: "desc",
        },
        take: 5,
      }),

      prisma.focusBlock.findMany({
        where: {
          userId,
          startIso: {
            gte: last7,
          },
        },
      }),

      prisma.task.findMany({
        where: {
          userId,
          startIso: {
            gte: last7,
          },
        },
      }),
    ]);

  const missedItems = [
    ...missedBlocks.map((block) => ({
      id: block.id,
      type: "focus_block" as const,
      title: block.title,
      category: block.leverCategory ?? "admin",
      startIso: block.startIso,
      durationMinutes: Math.max(
        20,
        Math.round((block.endIso.getTime() - block.startIso.getTime()) / 60000)
      ),
    })),

    ...missedTasks
      .filter((task) => task.startIso && task.endIso)
      .map((task) => ({
        id: task.id,
        type: "task" as const,
        title: task.title,
        category: task.category ?? "admin",
        startIso: task.startIso as Date,
        durationMinutes: Math.max(
          20,
          Math.round(
            ((task.endIso as Date).getTime() - (task.startIso as Date).getTime()) /
              60000
          )
        ),
      })),
  ].sort((a, b) => b.startIso.getTime() - a.startIso.getTime());

  if (missedItems.length === 0) {
    return null;
  }

  const missed = missedItems[0];

  const totalLast7 = recentBlocks.length + recentTasks.length;

  const missedLast7 =
    recentBlocks.filter((block) => block.status === "missed").length +
    recentTasks.filter((task) => task.status === "missed").length;

  const completedLast7 =
    recentBlocks.filter((block) => block.status === "completed").length +
    recentTasks.filter((task) => task.status === "completed").length;

  const burnout = detectBurnoutRisk({
    missedLast7,
    completedLast7,
    totalLast7,
  });

  const slot = await chooseSmartSlot({
    userId,
    durationMinutes: missed.durationMinutes,
    category: missed.category,
    includeGoogleBusy: true,
  });

  return {
    missedItemId: missed.id,
    missedItemType: missed.type,
    title: missed.title,
    category: missed.category,
    missedStartIso: missed.startIso.toISOString(),
    suggestedStartIso: slot.start.toISOString(),
    suggestedEndIso: slot.end.toISOString(),
    schedulerScore: slot.score,
    reasons: [
      ...slot.reasons,
      burnout.risk === "high"
        ? "Recovery block is intentionally conservative because burnout risk is high."
        : "Recovery slot selected from your best available window.",
    ],
    burnoutRisk: burnout.risk,
    burnoutSignals: burnout.signals,
  };
}

export async function autoRescheduleMissedWork(userId: string) {
  await ensureUser(userId);

  const suggestion = await getRecoverySuggestion(userId);

  if (!suggestion) {
    return {
      ok: true,
      rescheduled: false,
      reason: "No missed work found.",
    };
  }

  if (suggestion.missedItemType === "focus_block") {
    const updated = await prisma.focusBlock.update({
      where: {
        id: suggestion.missedItemId,
      },
      data: {
        startIso: new Date(suggestion.suggestedStartIso),
        endIso: new Date(suggestion.suggestedEndIso),
        status: "scheduled",
      },
    });

    await prisma.actionsLog.create({
      data: {
        userId,
        actionType: "reserve_block",
        payload: {
          suggestion,
        },
        undoPayload: {
          operation: "mark_focus_block_missed",
          focusBlockId: updated.id,
        },
      },
    });

    await trackAnalytics(userId, "missed_block_rescheduled", {
      focusBlockId: updated.id,
      burnoutRisk: suggestion.burnoutRisk,
    });

    await rebuildPatternProfile(userId);

    return {
      ok: true,
      rescheduled: true,
      suggestion,
      item: updated,
    };
  }

  const updated = await prisma.task.update({
    where: {
      id: suggestion.missedItemId,
    },
    data: {
      startIso: new Date(suggestion.suggestedStartIso),
      endIso: new Date(suggestion.suggestedEndIso),
      status: "scheduled",
    },
  });

  await prisma.actionsLog.create({
    data: {
      userId,
      actionType: "schedule_task",
      payload: {
        suggestion,
      },
      undoPayload: {
        operation: "mark_task_missed",
        taskId: updated.id,
      },
    },
  });

  await trackAnalytics(userId, "missed_task_rescheduled", {
    taskId: updated.id,
    burnoutRisk: suggestion.burnoutRisk,
  });

  await rebuildPatternProfile(userId);

  return {
    ok: true,
    rescheduled: true,
    suggestion,
    item: updated,
  };
}