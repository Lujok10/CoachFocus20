import { Prisma } from "@prisma/client";
import { chooseSmartSlot } from "./scheduler";
import { prisma, ensureUser } from "./db";
import {
  googleCreateOrUpdateFocusEvent,
  googleDeleteEvent,
  googleFreeBusy,
  googleMoveEvent,
} from "./google";
import { runAiPlanner } from "./planner";
import { ensurePatternProfile, rebuildPatternProfile } from "./patterns";
import { trackAnalytics } from "./analytics";

import {
  scheduleFocusBlockNotifications,
  scheduleEndOfDayCheckin,
} from "./push";

function categoryPriority(category: LeverCategory) {
  if (category === "income") return 10;
  if (category === "learning") return 8;
  if (category === "admin") return 6;
  if (category === "creative") return 5;
  if (category === "family") return 4;
  if (category === "health") return 3;

  return 1;
}

function calculateHighLeverageScore(input: {
  category: LeverCategory;
  confidence: number;
  durationMinutes: number;
}) {
  const categoryScore = categoryPriority(input.category);
  const confidenceScore = Math.max(0, Math.min(1, input.confidence / 100));
  const effortPenalty = Math.min(3, input.durationMinutes / 60);

  return categoryScore + confidenceScore * 4 - effortPenalty;
}

function scoreToPredictedImpact(score: number) {
  return Math.max(1, Math.min(10, Math.round(score)));
}

type ReservationStatus = "reserved" | "suggested" | "queued" | "cancelled";

type LeverCategory =
  | "income"
  | "health"
  | "family"
  | "admin"
  | "learning"
  | "creative";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return { start, end };
}

function hhmm(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}


function getPlannerCacheKey(userId: string) {
  const today = new Date().toISOString().slice(0, 10);

  return `planner:${userId}:${today}`;
}

function getPlannerCacheExpiry() {
  const expires = new Date();

  expires.setHours(23, 59, 59, 999);

  return expires;
}

function getWindowLabel(date: Date) {
  return date.getHours() < 12 ? "AM" : "PM";
}

async function userHasCalendarWriteScope(userId: string) {
  const connection = await prisma.googleCalendarConnection.findUnique({
    where: { userId },
  });

  const scope = connection?.scope ?? "";

  return (
    scope.includes("https://www.googleapis.com/auth/calendar") ||
    scope.includes("https://www.googleapis.com/auth/calendar.events")
  );
}

async function chooseSlot(userId: string, durationMinutes = 60) {
  const now = new Date();
  const proposedStart = addMinutes(now, 15);
  proposedStart.setSeconds(0, 0);

  const proposedEnd = addMinutes(proposedStart, durationMinutes);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  const canReadCalendar =
    Boolean(user?.calendarConnected) &&
    (await userHasCalendarWriteScope(userId));

  if (!canReadCalendar) {
    return {
      start: proposedStart,
      end: proposedEnd,
    };
  }

  const { start: dayStart, end: dayEnd } = todayRange();

  const busy = await googleFreeBusy(
    userId,
    dayStart.toISOString(),
    dayEnd.toISOString()
  ).catch(() => []);

  const candidateHours = [9, 10, 11, 13, 14, 15, 16];

  for (const hour of candidateHours) {
    const slotStart = new Date();
    slotStart.setHours(hour, 0, 0, 0);

    if (slotStart < now) continue;

    const slotEnd = addMinutes(slotStart, durationMinutes);

    const hasConflict = busy.some((item: any) => {
      const busyStart = new Date(item.start ?? "");
      const busyEnd = new Date(item.end ?? "");

      if (
        Number.isNaN(busyStart.getTime()) ||
        Number.isNaN(busyEnd.getTime())
      ) {
        return false;
      }

      return slotStart < busyEnd && slotEnd > busyStart;
    });

    if (!hasConflict) {
      return {
        start: slotStart,
        end: slotEnd,
      };
    }
  }

  return {
    start: proposedStart,
    end: proposedEnd,
  };
}

function buildWakePlan(input: {
  block: any;
  actionId: string;
  planner: {
    leverTitle: string;
    leverCategory: string;
    why: string;
    plan: string[];
    alternatives?: Array<{
      title: string;
      category: LeverCategory;
    }>;
    confidence: number;
  };
  reservationStatus: ReservationStatus;
  isReserved: boolean;
  calendarReconnectRequired: boolean;
  readOnlyCalendar: boolean;
}) {
  const {
    block,
    actionId,
    planner,
    reservationStatus,
    isReserved,
    calendarReconnectRequired,
    readOnlyCalendar,
  } = input;

  return {
    id: `wake_${block.id}`,

    sentence: `Your biggest lever today: ${planner.leverTitle} — block ${hhmm(
      block.startIso
    )}–${hhmm(block.endIso)}.`,

    lever: {
      title: planner.leverTitle,
      category: planner.leverCategory,
      predictedImpact: block.predictedImpact,
    },

    why:
      planner.why ||
      (block.predictedImpact >= 7
        ? "This is a high-leverage block based on category priority, confidence, and effort."
        : "This is the best available block right now, but Focus20 will continue looking for stronger high-leverage opportunities."),

    plan:
      planner.plan?.slice(0, 3) ?? [
        "Open the task or workspace.",
        "Work for the protected focus block.",
        "Capture the next action before stopping.",
      ],

    alternatives:
      planner.alternatives?.slice(0, 2).map((item, index) => {
        const score = Math.max(
          60,
          Math.round(
            block.predictedImpact * 8 +
              block.confidence * 0.3
          )
        );

        const reasonList = [
          `${capitalizeFirst(block.leverCategory)} currently has stronger completion momentum.`,
          "Today's recommendation has a higher predicted impact.",
          index === 0
            ? "This will likely become tomorrow's top recommendation."
            : "This remains an excellent backup option later today.",
        ];

    return {
      title: item.title,
      category: item.category,
      time: "Later today",
      whyNotReason: reasonList.join(" "),
      score,
      estimatedPriority: index + 2,
      recommendedTomorrow: index === 0,
      whyNot: reasonList,
    };
  }) ?? [],

    timeLeak: {
      title: "Unprotected calendar time",
      minutes: 30,
      fixAction: "Protect this block before distractions take over.",
    },

    confidenceLevel:
      block.confidence >= 80 ? "high" : block.confidence >= 60 ? "medium" : "low",

    confidence: block.confidence,

    block: {
      id: block.id,
      userId: block.userId,
      title: block.title,
      startIso: block.startIso.toISOString(),
      endIso: block.endIso.toISOString(),
      provider: block.provider,
      providerEventId: block.providerEventId,
      window: getWindowLabel(block.startIso),
      status: block.status,
      leverCategory: block.leverCategory,
      predictedImpact: block.predictedImpact,
      confidence: block.confidence,
      startTime: hhmm(block.startIso),
      endTime: hhmm(block.endIso),
      durationMinutes: Math.round(
        (block.endIso.getTime() - block.startIso.getTime()) / 60000
      ),
      date: block.startIso.toISOString().split("T")[0],
    },

    status: block.status,
    reserved: isReserved,
    isReserved,
    reservationStatus,
    calendarReconnectRequired,
    readOnlyCalendar,
    actionId,
    undoToken: actionId,
  };
}

export async function getRules(userId: string) {
  await ensureUser(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  return {
    userId: user.id,
    provider: user.provider,
    calendarConnected: user.calendarConnected,
    calendarPermission:
      user.calendarPermission === "read_only"
        ? "read-only"
        : user.calendarPermission,
    protectEnabled: user.protectEnabled,
    flexShiftEnabled: user.flexShiftEnabled,
    maxMovesPerDay: user.maxMovesPerDay,
    notificationsEnabled: user.notificationsEnabled,
    completedFirstLever: user.completedFirstLever,
    timezone: user.timezone,
    buffersMinutes: user.buffersMinutes,
  };
}

export async function updateRules(userId: string, data: Record<string, unknown>) {
  await ensureUser(userId);

  const permission =
    data.calendarPermission === "read-only"
      ? "read_only"
      : data.calendarPermission;

  await prisma.user.update({
    where: { id: userId },
    data: {
      protectEnabled:
        typeof data.protectEnabled === "boolean"
          ? data.protectEnabled
          : undefined,
      flexShiftEnabled:
        typeof data.flexShiftEnabled === "boolean"
          ? data.flexShiftEnabled
          : undefined,
      notificationsEnabled:
        typeof data.notificationsEnabled === "boolean"
          ? data.notificationsEnabled
          : undefined,
      buffersMinutes:
        typeof data.buffersMinutes === "number" ? data.buffersMinutes : undefined,
      calendarPermission:
        typeof permission === "string" ? (permission as any) : undefined,
    },
  });

  return getRules(userId);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function refreshWakePlan(userId: string, force = false) {
  await ensureUser(userId);
  await ensurePatternProfile(userId);
  await rebuildPatternProfile(userId);

 const plannerCacheKey = getPlannerCacheKey(userId);

let planner;

const cachedPlanner =
      await prisma.aiRecommendationCache.findUnique({
        where: {
          cacheKey: plannerCacheKey,
        },
      });

    if (
      cachedPlanner &&
      cachedPlanner.expiresAt > new Date()
    ) {
      planner =
        cachedPlanner.responseJson as Awaited<
          ReturnType<typeof runAiPlanner>
        >;
    } else {
      planner = await runAiPlanner(userId);

      await prisma.aiRecommendationCache.upsert({
        where: {
          cacheKey: plannerCacheKey,
        },
        update: {
          responseJson: planner as Prisma.JsonObject,
          expiresAt: getPlannerCacheExpiry(),
        },
        create: {
          userId,
          cacheKey: plannerCacheKey,
          responseJson: planner as Prisma.JsonObject,
          expiresAt: getPlannerCacheExpiry(),
        },
      });
    } 
  const rules = await getRules(userId);
  const { start: todayStart, end: todayEnd } = todayRange();

  let existing = await prisma.focusBlock.findFirst({
    where: {
      userId,
      startIso: {
        gte: todayStart,
        lt: todayEnd,
      },
      status: {
        not: "cancelled",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const canWriteToCalendar =
    rules.calendarConnected &&
    rules.calendarPermission === "write" &&
    rules.protectEnabled &&
    (await userHasCalendarWriteScope(userId));

  const slot = await chooseSmartSlot({
    userId,
    durationMinutes: 60,
    category: planner.leverCategory,
    includeGoogleBusy: canWriteToCalendar,
  });

  const title = `Focus 20: ${planner.leverTitle}`;
  const leverCategory = planner.leverCategory as LeverCategory;

  const durationMinutes =
    Math.round(
      (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000
    ) || 60;

  const highLeverageScore = calculateHighLeverageScore({
    category: leverCategory,
    confidence: planner.confidence,
    durationMinutes,
  });

  const predictedImpact = scoreToPredictedImpact(highLeverageScore);

  const confidence = Math.max(
    predictedImpact >= 8 ? 65 : 35,
    Math.min(95, Math.round(planner.confidence))
  );

  const confidenceDisplayValue =
    confidence > 1 ? confidence : Math.round(confidence * 100);

  let block = existing;

  if (!block) {
    block = await prisma.focusBlock.create({
      data: {
        userId,
        provider: canWriteToCalendar ? "google" : "local",
        providerEventId: null,
        title,
        startIso: slot.start,
        endIso: slot.end,
        status: "scheduled",
        leverCategory,
        predictedImpact,
        confidence,
      },
    });
  } else {
    block = await prisma.focusBlock.update({
      where: { id: block.id },
      data: {
        title,
        startIso: slot.start,
        endIso: slot.end,
        leverCategory,
        predictedImpact,
        confidence,
      },
    });
  }

  if (rules.notificationsEnabled && rules.completedFirstLever) {
    await scheduleFocusBlockNotifications({
      userId,
      focusBlockId: block.id,
      title: block.title,
      startIso: block.startIso.toISOString(),
    }).catch(console.error);

    await scheduleEndOfDayCheckin(userId).catch(console.error);
  }

  let providerEventId = block.providerEventId;
  let reservationStatus: ReservationStatus = canWriteToCalendar
    ? "reserved"
    : "suggested";
  let isReserved = false;

  if (canWriteToCalendar) {
    try {
      providerEventId = await googleCreateOrUpdateFocusEvent({
        userId,
        existingEventId: block.providerEventId ?? undefined,
        title: block.title,
        startIso: block.startIso.toISOString(),
        endIso: block.endIso.toISOString(),
        focusBlockId: block.id,
        leverCategory: block.leverCategory,
      });

      block = await prisma.focusBlock.update({
        where: { id: block.id },
        data: {
          provider: "google",
          providerEventId,
          status: "scheduled",
        },
      });

      reservationStatus = "reserved";
      isReserved = true;

      await trackAnalytics(userId, "block_reserved_silent", {
        blockId: block.id,
        providerEventId,
      });
    } catch (error) {
      console.error("Google Calendar write failed. Keeping local block.", error);

      block = await prisma.focusBlock.update({
        where: { id: block.id },
        data: {
          provider: "local",
          providerEventId: null,
          status: "scheduled",
        },
      });

      reservationStatus = "queued";
      isReserved = false;
    }
  }

  const action = await prisma.actionsLog.create({
    data: {
      userId,
      actionType: "reserve_block",
      payload: {
        blockId: block.id,
        title: block.title,
        providerEventId,
        startIso: block.startIso.toISOString(),
        endIso: block.endIso.toISOString(),
        reservationStatus,
        force,
        scheduler: {
          score: slot.score,
          reasons: slot.reasons,
          capacity: slot.capacity,
        },
      },
      undoPayload: {
        focusBlockId: block.id,
        providerEventId,
        operation: providerEventId
          ? "delete_google_event"
          : "cancel_focus_block",
      },
    },
  });

  await trackAnalytics(userId, "wake_sentence_shown", {
    focusBlockId: block.id,
    source: "cache",
  });

  await trackAnalytics(userId, "wake_plan_refreshed", {
    force,
    blockId: block.id,
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weeklyBlocks = await prisma.focusBlock.findMany({
    where: {
      userId,
      startIso: {
        gte: sevenDaysAgo,
      },
    },
  });

  const weeklyProtectedMinutes = weeklyBlocks.reduce(
    (total, item) =>
      total +
      Math.round((item.endIso.getTime() - item.startIso.getTime()) / 60000),
    0
  );

  const weeklyHighLeverageMinutes = weeklyBlocks.reduce((total, item) => {
    if (item.status !== "completed") return total;
    if (item.predictedImpact < 8) return total;

    return (
      total +
      Math.round((item.endIso.getTime() - item.startIso.getTime()) / 60000)
    );
  }, 0);

  const weeklyTotalFocusMinutes = weeklyBlocks.reduce((total, item) => {
    if (item.status !== "completed") return total;

    return (
      total +
      Math.round((item.endIso.getTime() - item.startIso.getTime()) / 60000)
    );
  }, 0);

  const realWeeklyParetoShare =
    weeklyTotalFocusMinutes === 0
      ? 0
      : Math.round((weeklyHighLeverageMinutes / weeklyTotalFocusMinutes) * 100);


   const weeklyInsight =
  realWeeklyParetoShare >= 80
    ? `Excellent. ${realWeeklyParetoShare}% of your completed focus time this week was spent on high-impact work. You're operating well above the Focus20 target.`
    : realWeeklyParetoShare >= 60
      ? `${realWeeklyParetoShare}% of your focus time has been high leverage. You're close to the ideal balance—one or two more strong sessions will push you above the target.`
      : realWeeklyParetoShare >= 40
        ? `${realWeeklyParetoShare}% of your focus time has been high leverage. You're making progress, but too much time is still being spent on lower-impact work.`
        : `Only ${realWeeklyParetoShare}% of your focus time has been high leverage. Focus20 recommends protecting more time for your highest-impact work next week.`;   

  const paretoWins = weeklyBlocks.filter(
    (item) => item.status === "completed" && item.predictedImpact >= 8
  ).length;

  const weeklyNeedleMoverWins = await prisma.feedback.count({
    where: {
      userId,
      createdAt: {
        gte: sevenDaysAgo,
      },
      needleMover: {
        in: ["yes", "somewhat"],
      },
    },
  });

  const recentCompletedRaw = await prisma.focusBlock.findMany({
  where: {
    userId,
    status: "completed",
  },
  orderBy: {
    endIso: "desc",
  },
  take: 5,
});

const recentFeedback = await prisma.feedback.findMany({
  where: {
    userId,
    focusBlockId: {
      in: recentCompletedRaw.map((item) => item.id),
    },
  },
});

const needleMoverBlockIds = new Set(
  recentFeedback
    .filter((item) => item.needleMover === "yes" || item.needleMover === "somewhat")
    .map((item) => item.focusBlockId)
);

const recentCompletedBlocksRaw = recentCompletedRaw.map((item) => ({
  title: item.title.replace(/^Focus 20:\s*/i, ""),
  category: item.leverCategory as LeverCategory,
  completedAtIso: item.endIso.toISOString(),
  durationMinutes: Math.round(
    (item.endIso.getTime() - item.startIso.getTime()) / 60000
  ),
  needleMover: needleMoverBlockIds.has(item.id),
}));

const categorySummary = new Map<
  LeverCategory,
  {
    completed: number;
    total: number;
  }
>();

for (const blockItem of weeklyBlocks) {
  const category = blockItem.leverCategory as LeverCategory;

  const current =
    categorySummary.get(category) ?? {
      completed: 0,
      total: 0,
    };

  current.total += 1;

  if (blockItem.status === "completed") {
    current.completed += 1;
  }

  categorySummary.set(category, current);
}

const strongestCategory = [...categorySummary.entries()].sort((a, b) => {
  const aRate = a[1].completed / Math.max(a[1].total, 1);
  const bRate = b[1].completed / Math.max(b[1].total, 1);

  return bRate - aRate;
})[0];

const strongestPatternMessage = strongestCategory
  ? `${capitalizeFirst(strongestCategory[0])} has become your strongest execution category with ${
      strongestCategory[1].completed
    } completed session${strongestCategory[1].completed === 1 ? "" : "s"} out of ${
      strongestCategory[1].total
    }.`
  : "Focus20 is still learning your strongest execution category.";

const recentCompletedGroups = new Map<
  string,
  {
    title: string;
    category: LeverCategory;
    completedAtIso: string;
    durationMinutes: number;
    needleMover?: boolean;
    count: number;
  }
>();

for (const item of recentCompletedBlocksRaw) {
  const key = `${item.title}-${item.category}`;
  const existingGroup = recentCompletedGroups.get(key);

  if (existingGroup) {
    existingGroup.count += 1;
    existingGroup.durationMinutes += item.durationMinutes;
    existingGroup.needleMover =
      existingGroup.needleMover || item.needleMover;
  } else {
    recentCompletedGroups.set(key, {
      ...item,
      count: 1,
    });
  }
}

const recentCompletedBlocks = Array.from(recentCompletedGroups.values())
  .map((item) => ({
    ...item,
    durationMinutes: Math.round(item.durationMinutes / item.count),
  }))
  .slice(0, 3);

const latestCompleted = recentCompletedBlocks[0];

const memoryInsight = latestCompleted
  ? `${strongestPatternMessage} Your most recent completed session was "${latestCompleted.title}". Focus20 is reinforcing the pattern that has produced your best results.`
  : strongestPatternMessage;
  
  const completedDays = new Set(
    weeklyBlocks
      .filter((item) => item.status === "completed")
      .map((item) => item.startIso.toISOString().split("T")[0])
  );

  const completedFocusBlocksThisWeek = weeklyBlocks.filter(
    (item) => item.status === "completed"
  ).length;

  const weeklyGoalTarget = 5;
  const weeklyGoalCompleted = paretoWins;

  const weeklyGoalRemaining = Math.max(
    0,
    weeklyGoalTarget - weeklyGoalCompleted
  );

  const dailyScoreBreakdown = [
  {
    label: "High-impact recommendation",
    points: Math.min(30, predictedImpact * 3),
    description: `This task has an estimated impact of ${predictedImpact}/10.`,
  },
  {
    label: "Protected focus time",
    points: Math.min(25, Math.round(weeklyProtectedMinutes / 12)),
    description: `${weeklyProtectedMinutes} protected minutes this week.`,
  },
  {
    label: "High-leverage wins",
    points: Math.min(20, paretoWins * 5),
    description: `${paretoWins}/${weeklyGoalTarget} weekly wins completed.`,
  },
  {
    label: "Recommendation confidence",
    points: Math.min(15, Math.round(confidenceDisplayValue * 0.15)),
    description: `${confidenceDisplayValue}% confidence based on recent completion patterns.`,
  },
  {
    label: "Priority lever",
    points: 10,
    description: `${capitalizeFirst(leverCategory)} is currently your strongest focus category.`,
  },
];

  

  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);

  const yesterdayEnd = new Date();
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const yesterdayBlocks = await prisma.focusBlock.findMany({
    where: {
      userId,
      status: "completed",
      startIso: {
        gte: yesterdayStart,
        lt: yesterdayEnd,
      },
    },
  });

  const yesterdayProtectedMinutes = yesterdayBlocks.reduce(
    (total, item) =>
      total +
      Math.round((item.endIso.getTime() - item.startIso.getTime()) / 60000),
    0
  );

  const yesterdayNeedleMovers = await prisma.feedback.count({
    where: {
      userId,
      needleMover: {
        in: ["yes", "somewhat"],
      },
      createdAt: {
        gte: yesterdayStart,
        lt: yesterdayEnd,
      },
    },
  });

  const yesterdayScore = clampNumber(
    25 +
      Math.min(25, yesterdayNeedleMovers * 12) +
      Math.min(25, Math.round(yesterdayProtectedMinutes / 12)),
    0,
    100
  );

  const todayScore = clampNumber(
    dailyScoreBreakdown.reduce((total, item) => total + item.points, 0),
    0,
    100
  );

 



  const nextMilestone =
    weeklyGoalRemaining === 0
      ? "Weekly high-leverage goal completed"
      : `${weeklyGoalRemaining} more high-leverage win${
          weeklyGoalRemaining === 1 ? "" : "s"
        } to complete this week’s goal`;

  const skipImpact = {
    projectedScoreDrop: 10,
    delayedLevelBy: "about one focus session",
  };

  let streakDays = 0;
  const cursor = new Date();

  for (let index = 0; index < 7; index++) {
    const dayKey = cursor.toISOString().split("T")[0];

    if (!completedDays.has(dayKey)) break;

    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const selectedCategory = planner.leverCategory as LeverCategory;

  const categoryBlocks = weeklyBlocks.filter(
    (item) => item.leverCategory === selectedCategory
  );

  const completedCategoryBlocks = categoryBlocks.filter(
    (item) => item.status === "completed"
  ).length;

  const completionRate =
    categoryBlocks.length === 0
      ? 0
      : Math.round((completedCategoryBlocks / categoryBlocks.length) * 100);

    const categoryLabel = capitalizeFirst(selectedCategory);    

   const todayVsYesterdayReasons = [
        weeklyProtectedMinutes > yesterdayProtectedMinutes
          ? `+${weeklyProtectedMinutes - yesterdayProtectedMinutes} more protected minutes than yesterday`
          : weeklyProtectedMinutes < yesterdayProtectedMinutes
            ? `${yesterdayProtectedMinutes - weeklyProtectedMinutes} fewer protected minutes than yesterday`
            : "Protected focus time is unchanged from yesterday",

        paretoWins > 0
          ? `${paretoWins} high-leverage win${paretoWins === 1 ? "" : "s"} this week`
          : "No high-leverage wins yet",

        `Recommendation confidence is ${confidenceDisplayValue}% based on your recent completion history`,

        completedCategoryBlocks > 0
          ? `${completedCategoryBlocks}/${categoryBlocks.length} ${categoryLabel} session${
              completedCategoryBlocks === 1 ? "" : "s"
            } completed this week`
          : `Still building ${categoryLabel} history`,
      ];  


  const todayVsYesterday = {
    todayScore,
    yesterdayScore,
    difference: todayScore - yesterdayScore,
    reasons: todayVsYesterdayReasons,
    reason:
      todayScore >= yesterdayScore
        ? `Today is trending higher because you have ${weeklyProtectedMinutes} protected focus minutes and ${paretoWins} high-leverage wins this week.`
        : "Today is trending lower because yesterday had stronger completed focus activity.",
  };

const dailyBrief = {
  headline:
    todayScore >= 85
      ? "You are set up for a strong focus day."
      : todayScore >= 65
        ? "You have a solid focus day ahead, but consistency matters today."
        : "Today needs a simpler plan with fewer distractions.",

  summary:
    todayScore >= yesterdayScore
      ? `Your focus score is trending up by ${todayScore - yesterdayScore} points. You have ${weeklyProtectedMinutes} protected minutes and ${paretoWins} high-leverage win${
          paretoWins === 1 ? "" : "s"
        } this week.`
      : `Your focus score is down ${Math.abs(
          todayScore - yesterdayScore
        )} points from yesterday. Focus20 recommends completing today's highest-leverage block first.`,

  priority:
    `Start with "${planner.leverTitle}" because ${categoryLabel} is your strongest active lever this week.`,

  nextAction:
    weeklyGoalRemaining === 0
      ? "Maintain momentum by completing today's block and logging the outcome."
      : `Complete ${weeklyGoalRemaining} more high-leverage win${
          weeklyGoalRemaining === 1 ? "" : "s"
        } to finish this week's goal.`,

  tone:
    todayScore >= 85 ? "excellent" : todayScore >= 65 ? "steady" : "recovery",
};

  const coachInsightMessage =
  categoryBlocks.length > 0
    ? `Over the last 7 days, you completed ${completedCategoryBlocks} ${selectedCategory} session${
        completedCategoryBlocks === 1 ? "" : "s"
      } out of ${categoryBlocks.length} scheduled. That gives ${selectedCategory} work a ${completionRate}% completion rate, so Focus20 is keeping this lever active while the pattern is still useful.`
    : `Focus20 is still learning your ${selectedCategory} execution pattern. Completing today's block will give the coach better data for future recommendations.`;
  const recommendationReason =
        completedCategoryBlocks > 0
          ? `Focus20 selected this because you've completed ${completedCategoryBlocks} ${categoryLabel} session${
              completedCategoryBlocks === 1 ? "" : "s"
            } during the last 7 days with a ${completionRate}% completion rate. Combined with ${weeklyProtectedMinutes} protected focus minutes and ${paretoWins} high-leverage wins, this is currently your strongest opportunity.`
        : `Focus20 selected this because ${categoryLabel} is currently your highest-priority lever and today's protected focus window is the best available opportunity to build momentum.`;
  const wakePlan = buildWakePlan({
    block,
    actionId: action.id,
    planner,
    reservationStatus,
    isReserved,
    calendarReconnectRequired: !rules.calendarConnected,
    readOnlyCalendar: rules.calendarPermission === "read-only",
  });

  wakePlan.why = recommendationReason;

  const xp =
    paretoWins * 50 +
    weeklyNeedleMoverWins * 40 +
    streakDays * 25 +
    Math.floor(weeklyProtectedMinutes / 10);

  const xpLevel = Math.max(1, Math.floor(xp / 500) + 1);
  const xpNextLevel = xpLevel * 500;

  const xpRemaining = Math.max(0, xpNextLevel - xp);

const estimatedFocusSessions = Math.max(
  1,
  Math.ceil(xpRemaining / 90)
);

const xpForecast = {
  xpRemaining,

  estimatedFocusSessions,

  message:
    estimatedFocusSessions === 1
      ? "Complete one strong focus session to reach the next level."
      : `Complete about ${estimatedFocusSessions} successful focus sessions to reach Level ${xpLevel + 1}.`,

  fastestPath: [
    "Complete today's recommended focus block.",
    "Mark it as a needle mover.",
    "Finish your weekly high-leverage goal.",
  ],
};

  const predictedSuccess = Math.min(
    95,
    Math.round(
      completionRate * 0.4 +
        confidenceDisplayValue * 0.4 +
        Math.min(streakDays * 2, 15)
    )
  );

  const predictedProductivityGain = Math.round(
    predictedImpact * (confidenceDisplayValue / 100) * 1.5
  );

  return {
    ...wakePlan,

    weeklyProtectedMinutes,
    paretoWins,
    weeklyNeedleMoverWins,
    streakDays,

    weeklyHighLeverageMinutes,
    weeklyInsight,
    weeklyTotalFocusMinutes,
    weeklyParetoShare: realWeeklyParetoShare,

    dailyScoreBreakdown,
    todayVsYesterday,
    dailyBrief,
    completedFocusBlocksThisWeek,

    weeklyGoalTarget,
    weeklyGoalCompleted,
    weeklyGoalRemaining,
    nextMilestone,
    skipImpact,

    xp,
    xpLevel,
    xpNextLevel,
    xpForecast,

    recentCompletedBlocks,
    memoryInsight,

    predictedSuccess,
    predictedProductivityGain,

    coachInsight: {
      category: selectedCategory,
      completedCategoryBlocks,
      completionRate,
      message: coachInsightMessage,
    },
  };
}

export async function listCalendarEvents(
  userId: string,
  startIso: string,
  endIso: string
) {
  await ensureUser(userId);

  const start = new Date(startIso);
  const end = new Date(endIso);

  const [blocks, tasks] = await Promise.all([
    prisma.focusBlock.findMany({
      where: {
        userId,
        startIso: {
          gte: start,
          lte: end,
        },
        status: {
          not: "cancelled",
        },
      },
      orderBy: {
        startIso: "asc",
      },
    }),

    prisma.task.findMany({
      where: {
        userId,
        startIso: {
          gte: start,
          lte: end,
        },
        status: {
          not: "unscheduled",
        },
      },
      orderBy: {
        startIso: "asc",
      },
    }),
  ]);

  return [
    ...blocks.map((block) => ({
      id: block.id,
      title: block.title,
      start: block.startIso,
      end: block.endIso,
      type: "focus",
      providerEventId: block.providerEventId,
      isFocusBlock: true,
      busy: true,
    })),

    ...tasks
      .filter((task) => task.startIso && task.endIso)
      .map((task) => ({
        id: task.id,
        title: task.title,
        start: task.startIso,
        end: task.endIso,
        type: task.protectAsFocus ? "focus" : "task",
        providerEventId: task.providerEventId,
        isFocusBlock: Boolean(task.protectAsFocus),
        busy: true,
      })),
  ];
}

export async function recordCheckin(input: {
    focusBlockId: string;
    result: "crushed" | "meh" | "missed";
    needleMover: "yes" | "somewhat" | "no" | "unconfirmed";
    noteText?: string;
  }) {
    const focusBlock = await prisma.focusBlock.findUnique({
      where: {
        id: input.focusBlockId,
      },
    });

  if (!focusBlock) {
      const error = new Error(
        "This focus session is no longer available. Start a new focus block and try again."
      );

      Object.assign(error, {
        statusCode: 404,
      });

      throw error;
    }

  const status = input.result === "missed" ? "missed" : "completed";

  const feedback = await prisma.feedback.create({
    data: {
      userId: focusBlock.userId,
      focusBlockId: focusBlock.id,
      result: input.result,
      needleMover: input.needleMover,
      noteText: input.noteText ?? null,
    },
  });

  await prisma.focusBlock.update({
    where: {
      id: focusBlock.id,
    },
    data: {
      status,
    },
  });

  if (
  status === "completed" &&
  (input.needleMover === "yes" ||
    input.result === "crushed")
) {
  await prisma.user.update({
    where: {
      id: focusBlock.userId,
    },
    data: {
      completedFirstLever: true,
    },
  });
}

  await trackAnalytics(focusBlock.userId, "voice_checkin_used", {
    focusBlockId: focusBlock.id,
    result: input.result,
    needleMover: input.needleMover,
  });

  await trackAnalytics(focusBlock.userId, "needle_mover_feedback_recorded", {
    focusBlockId: focusBlock.id,
    needleMover: input.needleMover,
  });

  await trackAnalytics(focusBlock.userId, "block_completed", {
    focusBlockId: focusBlock.id,
    status,
  });

 await rebuildPatternProfile(focusBlock.userId);

await prisma.aiRecommendationCache.deleteMany({
  where: {
    userId: focusBlock.userId,
    },
  });

  return {
    ok: true,
    feedback,
    status,
  };
}

export async function startFocusBlock(userId: string, focusBlockId?: string) {
  await ensureUser(userId);

  let block = focusBlockId
    ? await prisma.focusBlock.findFirst({
        where: {
          id: focusBlockId,
          userId,
        },
      })
    : null;

  if (!block) {
    block = await prisma.focusBlock.findFirst({
      where: {
        userId,
        status: {
          in: ["scheduled", "started"],
        },
      },
      orderBy: {
        startIso: "asc",
      },
    });
  }

  if (!block) {
    throw new Error("No FocusBlock found to start.");
  }

  const updated = await prisma.focusBlock.update({
    where: {
      id: block.id,
    },
    data: {
      status: "started",
    },
  });

  await trackAnalytics(userId, "block_started", {
    focusBlockId: updated.id,
  });

  return {
    ok: true,
    block: updated,
    shouldStartTimer: true,
  };
}

export async function undoAction(actionId: string) {
  const action = await prisma.actionsLog.findUnique({
    where: { id: actionId },
  });

  if (!action || action.status !== "applied") {
    return {
      success: false,
      reason: "Action not found or already undone.",
    };
  }

  const undo = action.undoPayload as {
    providerEventId?: string | null;
    focusBlockId?: string;
    operation?: string;
  };

  if (undo.providerEventId && undo.operation === "delete_google_event") {
    await googleDeleteEvent(action.userId, undo.providerEventId).catch((error) => {
      console.error("Google event delete failed during undo.", error);
    });
  }

  if (undo.focusBlockId) {
    await prisma.focusBlock.update({
      where: { id: undo.focusBlockId },
      data: { status: "cancelled" },
    });
  }

  await prisma.actionsLog.update({
    where: { id: actionId },
    data: { status: "undone" },
  });

  await trackAnalytics(action.userId, "undo_used", {
    actionId,
  });

  await rebuildPatternProfile(action.userId);

  return {
    success: true,
  };
}

export async function canSendNotification(userId?: string) {
  if (!userId) {
    return {
      allowed: false,
      reason: "Missing user.",
    };
  }

  await ensureUser(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user?.notificationsEnabled) {
    return {
      allowed: false,
      reason: "Notifications disabled.",
    };
  }

  if (!user.completedFirstLever) {
    return {
      allowed: false,
      reason: "Complete first lever before notifications.",
    };
  }

  const { start, end } = todayRange();

  const sentToday = await prisma.analyticsEvent.count({
    where: {
      userId,
      name: "notification_sent",
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  });

  if (sentToday >= 999) {
    return {
      allowed: false,
      reason: "Daily notification limit reached.",
    };
  }

  return {
    allowed: true,
    sentToday,
  };
}

export async function logNotificationSent(input: {
  userId?: string;
  focusBlockId?: string;
  type: "pre_block_reminder" | "end_of_day_checkin" | string;
}) {
  if (!input.userId) {
    return {
      ok: false,
      reason: "Missing user.",
    };
  }

  const check = await canSendNotification(input.userId);

  if (!check.allowed) {
    return {
      ok: false,
      reason: check.reason,
    };
  }

  await trackAnalytics(input.userId, "notification_sent", {
    type: input.type,
    focusBlockId: input.focusBlockId ?? null,
  });

  await prisma.actionsLog.create({
    data: {
      userId: input.userId,
      actionType: "notification_sent",
      payload: {
        type: input.type,
        focusBlockId: input.focusBlockId ?? null,
      },
      undoPayload: {
        notUndoable: true,
      },
    },
  });

  return {
    ok: true,
  };
}

function isProtectedEventTitle(title: string) {
  const lower = title.toLowerCase();

  return (
    lower.includes("medical") ||
    lower.includes("doctor") ||
    lower.includes("family") ||
    lower.includes("travel") ||
    lower.includes("flight") ||
    lower.includes("school") ||
    lower.includes("protected")
  );
}

function isFlexEventTitle(title: string) {
  return title.toLowerCase().includes("flex");
}

export async function previewFlexShift(input: {
  userId?: string;
  startIso: string;
  endIso: string;
}) {
  if (!input.userId) {
    return {
      ok: false,
      reason: "Missing user.",
      candidates: [],
    };
  }

  const rules = await getRules(input.userId);

  if (!rules.flexShiftEnabled) {
    return {
      ok: false,
      reason: "Flex shift is not enabled.",
      candidates: [],
    };
  }

  const busy = await googleFreeBusy(input.userId, input.startIso, input.endIso).catch(
    () => []
  );

  const candidates = busy
    .filter((event: any) => {
      const title = event.title ?? event.summary ?? "";

      if (!isFlexEventTitle(title)) return false;
      if (isProtectedEventTitle(title)) return false;
      if (event.attendees?.length > 0) return false;

      return true;
    })
    .slice(0, 3)
    .map((event: any, index: number) => {
      const oldStart = new Date(event.start);
      const oldEnd = new Date(event.end);
      const durationMs = oldEnd.getTime() - oldStart.getTime();

      const newStart = addMinutes(oldEnd, 30);
      const newEnd = new Date(newStart.getTime() + durationMs);

      return {
        id: event.id ?? `flex-candidate-${index}`,
        title: event.title ?? event.summary ?? "FLEX event",
        oldStartIso: oldStart.toISOString(),
        oldEndIso: oldEnd.toISOString(),
        newStartIso: newStart.toISOString(),
        newEndIso: newEnd.toISOString(),
        reason: "FLEX-tagged event can be moved to protect Focus 20 time.",
      };
    });

  await trackAnalytics(input.userId, "flex_shift_previewed", {
    candidateCount: candidates.length,
  });

  return {
    ok: true,
    candidates,
  };
}

export async function applyFlexShift(input: {
  userId?: string;
  eventId: string;
  title: string;
  oldStartIso: string;
  oldEndIso: string;
  newStartIso: string;
  newEndIso: string;
  reason?: string;
}) {
  if (!input.userId) {
    return {
      ok: false,
      reason: "Missing user.",
    };
  }

  const rules = await getRules(input.userId);

  if (!rules.flexShiftEnabled) {
    return {
      ok: false,
      reason: "Flex shift is not enabled.",
    };
  }

  if (!isFlexEventTitle(input.title)) {
    return {
      ok: false,
      reason: "Only FLEX-tagged events can be shifted.",
    };
  }

  if (isProtectedEventTitle(input.title)) {
    return {
      ok: false,
      reason: "Protected events cannot be shifted.",
    };
  }

  const { start, end } = todayRange();

  const movesToday = await prisma.actionsLog.count({
    where: {
      userId: input.userId,
      actionType: "flex_event_shifted",
      status: "applied",
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  });

  if (movesToday >= rules.maxMovesPerDay) {
    return {
      ok: false,
      reason: "Daily flex shift limit reached.",
    };
  }

  const movedEventId = await googleMoveEvent({
    userId: input.userId,
    eventId: input.eventId,
    startIso: input.newStartIso,
    endIso: input.newEndIso,
    reason: input.reason ?? "Focus20 flex shift",
  });

  const action = await prisma.actionsLog.create({
    data: {
      userId: input.userId,
      actionType: "flex_event_shifted",
      payload: {
        eventId: input.eventId,
        movedEventId,
        title: input.title,
        oldStartIso: input.oldStartIso,
        oldEndIso: input.oldEndIso,
        newStartIso: input.newStartIso,
        newEndIso: input.newEndIso,
        reason: input.reason ?? "Focus20 flex shift",
      },
      undoPayload: {
        operation: "move_google_event_back",
        eventId: movedEventId,
        oldStartIso: input.oldStartIso,
        oldEndIso: input.oldEndIso,
      },
    },
  });

  await trackAnalytics(input.userId, "flex_event_shifted", {
    eventId: movedEventId,
    actionId: action.id,
  });

  return {
    ok: true,
    movedEventId,
    actionId: action.id,
  };
}

export async function trackEvent(
  userId: string,
  name: string,
  payload: Prisma.InputJsonValue = {}
) {
  await ensureUser(userId);

  return trackAnalytics(userId, name, payload);
}