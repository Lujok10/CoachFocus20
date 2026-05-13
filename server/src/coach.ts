import { Prisma } from "@prisma/client";
import { queueCalendarWrite } from "./retryQueue";
import {
  prisma,
  DEMO_USER_ID,
  ensureDemoUser,
  ensureUser,
} from "./db";
import {
  googleCreateOrUpdateFocusEvent,
  googleDeleteEvent,
  googleFreeBusy,
} from "./google";
import { runAiPlanner } from "./planner";

type LeverCategory =
  | "income"
  | "health"
  | "family"
  | "admin"
  | "learning"
  | "creative";

type ReservationStatus = "reserved" | "suggested" | "queued" | "cancelled";

const levers: Record<LeverCategory, string[]> = {
  income: [
    "finish income-stream tweaks",
    "complete client proposal draft",
    "finalize pricing strategy",
  ],
  health: [
    "plan weekly meal prep",
    "complete workout routine design",
    "review sleep analytics",
  ],
  family: [
    "plan weekend family activity",
    "schedule family check-in",
    "review school calendar",
  ],
  admin: ["clear inbox backlog", "organize digital files", "update project tracker"],
  learning: ["complete course module", "write learning summary", "practice new skill"],
  creative: ["draft creative brief", "brainstorm new ideas", "review design concepts"],
};

const planTemplates: Record<LeverCategory, string[]> = {
  income: ["Review current state", "Ship the smallest valuable change", "Capture next action"],
  health: ["Pick one habit", "Schedule the exact block", "Remove one obstacle"],
  family: ["Confirm availability", "Make the plan simple", "Send one message"],
  admin: ["Sort by priority", "Finish the top item", "Archive or defer the rest"],
  learning: ["Review last note", "Complete one module", "Write a 3-line summary"],
  creative: ["Brainstorm freely", "Choose the best option", "Create the first draft"],
};

const whyReasons: Record<LeverCategory, string> = {
  income: "This has the highest recent impact signal and moves your revenue goals forward.",
  health: "Your strongest focus days usually follow protected health planning.",
  family: "This reduces background stress and protects your important relationships.",
  admin: "Clearing this removes friction before deeper work later today.",
  learning: "This compounds into your next skill milestone.",
  creative: "This is the highest-leverage creative task based on your recent pattern.",
};

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

function atTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function clampScore(value: number) {
  return Math.max(0.05, Math.min(0.99, value));
}

function getWindowKey(date: Date) {
  const hour = date.getHours();

  if (hour < 10) return "early_morning";
  if (hour < 12) return "late_morning";
  if (hour < 15) return "early_afternoon";
  if (hour < 18) return "late_afternoon";

  return "evening";
}

function scoreDelta(result: string, needleMover: string) {
  if (result === "crushed" && needleMover === "yes") return 0.08;
  if (result === "crushed" && needleMover === "somewhat") return 0.04;
  if (result === "meh" && needleMover === "yes") return 0.02;
  if (result === "meh") return -0.02;
  if (result === "missed") return -0.06;

  return 0;
}

async function defaultPattern() {
  const existing = await prisma.patternProfile.findUnique({
    where: { userId: DEMO_USER_ID },
  });

  if (existing) return existing;

  try {
    return await prisma.patternProfile.create({
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
          meetingsPeakConflict: 0.42,
          contextSwitching: 0.34,
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const profile = await prisma.patternProfile.findUnique({
        where: { userId: DEMO_USER_ID },
      });

      if (profile) return profile;
    }

    throw error;
  }
}

async function getAdaptivePlanningSignals(category: LeverCategory) {
  await ensureDemoUser();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const blocks = await prisma.focusBlock.findMany({
    where: {
      userId: DEMO_USER_ID,
      createdAt: {
        gte: since,
      },
    },
    include: {
      feedback: true,
    },
  });

  const categoryBlocks = blocks.filter(
    (block) => block.leverCategory === category
  );

  const completedBlocks = categoryBlocks.filter(
    (block) => block.status === "completed"
  );

  const missedBlocks = categoryBlocks.filter(
    (block) => block.status === "missed"
  );

  const needleMoverWins = categoryBlocks.filter((block) =>
    block.feedback.some(
      (feedback) =>
        feedback.result === "crushed" && feedback.needleMover === "yes"
    )
  );

  const completionRate =
    categoryBlocks.length === 0
      ? 0.5
      : completedBlocks.length / categoryBlocks.length;

  const missRate =
    categoryBlocks.length === 0 ? 0.1 : missedBlocks.length / categoryBlocks.length;

  const needleMoverRate =
    categoryBlocks.length === 0
      ? 0.5
      : needleMoverWins.length / categoryBlocks.length;

  const successfulDurations = categoryBlocks
    .filter((block) => block.status === "completed")
    .map((block) =>
      Math.round((block.endIso.getTime() - block.startIso.getTime()) / 60000)
    )
    .filter((minutes) => minutes > 0);

  return {
    totalBlocks: categoryBlocks.length,
    completionRate,
    missRate,
    needleMoverRate,
    successfulDurations,
  };
}

function chooseDynamicDuration(signals: {
  totalBlocks: number;
  completionRate: number;
  missRate: number;
  successfulDurations: number[];
}) {
  if (signals.totalBlocks < 3) return 30;
  if (signals.missRate >= 0.4) return 20;

  if (signals.completionRate >= 0.8) {
    const avgSuccessful =
      signals.successfulDurations.reduce((sum, value) => sum + value, 0) /
      Math.max(1, signals.successfulDurations.length);

    if (avgSuccessful >= 50) return 60;
    if (avgSuccessful >= 40) return 45;
    return 30;
  }

  if (signals.completionRate >= 0.6) return 45;

  return 30;
}

function calculateAdaptiveConfidence(input: {
  plannerConfidence: number;
  completionRate: number;
  needleMoverRate: number;
  missRate: number;
  windowScore?: number;
}) {
  const completionBoost = (input.completionRate - 0.5) * 25;
  const needleMoverBoost = (input.needleMoverRate - 0.5) * 25;
  const missPenalty = input.missRate * 20;
  const windowBoost = ((input.windowScore ?? 0.7) - 0.7) * 15;

  const score =
    input.plannerConfidence +
    completionBoost +
    needleMoverBoost +
    windowBoost -
    missPenalty;

  return Math.max(35, Math.min(95, Math.round(score)));
}

async function getBestWindowScore() {
  const profile = await defaultPattern();

  const windows = profile.bestWindows as Array<{
    start: string;
    end: string;
    score: number;
  }>;

  return [...windows].sort((a, b) => b.score - a.score)[0]?.score ?? 0.7;
}

async function chooseSlot(durationMinutes = 60) {
  const profile = await defaultPattern();

  const windows = profile.bestWindows as Array<{
    start: string;
    end: string;
    score: number;
  }>;

  const now = new Date();
  const { start, end } = todayRange();

  const busy = await googleFreeBusy(start.toISOString(), end.toISOString()).catch(
    () => []
  );

  const sortedWindows = [...windows].sort((a, b) => b.score - a.score);

  for (const window of sortedWindows) {
    const slotStart = atTime(window.start);

    if (slotStart < now) continue;

    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);

    const hasConflict = busy.some((item) => {
      const busyStart = new Date(item.start ?? "");
      const busyEnd = new Date(item.end ?? "");

      if (Number.isNaN(busyStart.getTime()) || Number.isNaN(busyEnd.getTime())) {
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

  const fallback = new Date(now.getTime() + 60 * 60_000);
  fallback.setMinutes(0, 0, 0);

  return {
    start: fallback,
    end: new Date(fallback.getTime() + 30 * 60_000),
  };
}

export async function trackEvent(
  name: string,
  payload?: Prisma.InputJsonValue
) {
  await ensureDemoUser();

  return prisma.analyticsEvent.create({
    data: {
      userId: DEMO_USER_ID,
      name,
      payload: payload ?? Prisma.JsonNull,
    },
  });
}

export async function getRules(userId: string = DEMO_USER_ID) {
  let user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user && userId === DEMO_USER_ID) {
    user = await ensureDemoUser();
  }

  if (!user) {
    user = await ensureUser(userId);
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

export async function updateRules(
  userId: string = DEMO_USER_ID,
  data: Record<string, unknown>
) {
  if (userId === DEMO_USER_ID) {
    await ensureDemoUser();
  }

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
        typeof data.buffersMinutes === "number"
          ? data.buffersMinutes
          : undefined,
      calendarPermission:
        typeof permission === "string" ? (permission as any) : undefined,
    },
  });

  return getRules(userId);
}

function buildPlan(input: {
  block: any;
  lever: {
    title: string;
    category: LeverCategory;
    predictedImpact: number;
  };
  actionId?: string;
  confidence: number;
  reservationStatus: ReservationStatus;
  isReserved: boolean;
  calendarReconnectRequired: boolean;
  readOnlyCalendar: boolean;
  why?: string;
  plan?: string[];
}) {
  const {
    block,
    lever,
    actionId,
    confidence,
    reservationStatus,
    isReserved,
    calendarReconnectRequired,
    readOnlyCalendar,
    why,
    plan,
  } = input;

  const altCategory =
    (Object.keys(levers) as LeverCategory[]).find(
      (category) => category !== lever.category
    ) ?? "learning";

  return {
    id: `wake_${block.id}`,
    sentence: `Your biggest lever today: ${lever.title} — block ${hhmm(
      block.startIso
    )}–${hhmm(block.endIso)}.`,
    lever,
    block: {
      id: block.id,
      userId: block.userId,
      provider: block.provider,
      providerEventId: block.providerEventId ?? undefined,
      title: block.title,
      startIso: block.startIso.toISOString(),
      endIso: block.endIso.toISOString(),
      createdBy: block.createdBy ?? "ai",
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
    why:
      why ??
      whyReasons[lever.category] ??
      "This is the best current needle-mover based on your recent patterns.",
    plan:
      plan?.slice(0, 3) ??
      planTemplates[lever.category] ??
      ["Start the task.", "Protect the block.", "Capture the next action."],
    alternatives: [
      {
        title: levers[altCategory][0],
        time: "14:00–15:00",
        category: altCategory,
      },
    ],
    timeLeak: {
      title: "FLEX admin block is close to deep-work time",
      minutes: 25,
      fixAction: "Keep flex shifting off unless you approve it",
    },
    isReserved,
    status: block.status,
    actionId: actionId ?? "",
    undoToken: actionId ?? "",
    confidence,
    reservationStatus,
    calendarReconnectRequired,
    readOnlyCalendar,
  };
}

export async function refreshWakePlan(force = false) {
  await ensureDemoUser();

  const { start, end } = todayRange();
  const rules = await getRules();
  const planner = await runAiPlanner();

  const lever = {
    title: planner.leverTitle,
    category: planner.leverCategory as LeverCategory,
    predictedImpact: Math.max(1, Math.round(planner.confidence / 20)),
  };

  const signals = await getAdaptivePlanningSignals(lever.category);
  const dynamicDuration = chooseDynamicDuration(signals);
  const windowScore = await getBestWindowScore();

  const confidence = calculateAdaptiveConfidence({
    plannerConfidence: planner.confidence,
    completionRate: signals.completionRate,
    needleMoverRate: signals.needleMoverRate,
    missRate: signals.missRate,
    windowScore,
  });

  const slot = await chooseSlot(dynamicDuration);
  const title = `Focus 20: ${lever.title}`;

  const existing = await prisma.focusBlock.findFirst({
    where: {
      userId: DEMO_USER_ID,
      startIso: {
        gte: start,
        lt: end,
      },
      status: {
        not: "cancelled",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const undoneToday = await prisma.actionsLog.findFirst({
    where: {
      userId: DEMO_USER_ID,
      status: "undone",
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const canWriteCalendar =
    rules.calendarConnected &&
    rules.calendarPermission === "write" &&
    rules.protectEnabled;

  if (undoneToday && !force && !existing) {
    const suggested = await prisma.focusBlock.create({
      data: {
        userId: DEMO_USER_ID,
        provider: "local",
        title,
        startIso: slot.start,
        endIso: slot.end,
        status: "cancelled",
        leverCategory: lever.category,
        predictedImpact: lever.predictedImpact,
        confidence,
      },
    });

    const plan = buildPlan({
      block: suggested,
      lever,
      confidence,
      reservationStatus: "suggested",
      isReserved: false,
      calendarReconnectRequired: !rules.calendarConnected,
      readOnlyCalendar: rules.calendarPermission === "read-only",
      why: planner.why,
      plan: planner.plan,
    });

    await trackEvent("wake_sentence_shown", {
      wakePlanId: plan.id,
      source: "backend",
      afterUndo: true,
    });

    await trackEvent("wake_plan_refreshed", {
      wakePlanId: plan.id,
      force,
      afterUndo: true,
    });

    return plan;
  }

  let block =
    existing ??
    (await prisma.focusBlock.create({
      data: {
        userId: DEMO_USER_ID,
        provider: canWriteCalendar ? "google" : "local",
        title,
        startIso: slot.start,
        endIso: slot.end,
        status: canWriteCalendar ? "scheduled" : "cancelled",
        leverCategory: lever.category,
        predictedImpact: lever.predictedImpact,
        confidence,
      },
    }));

  let actionId = "";
  let reservationStatus: ReservationStatus = canWriteCalendar
    ? "reserved"
    : "suggested";
  let isReserved = false;

  if (canWriteCalendar) {
    const shouldUpdateCalendar =
      force ||
      !block.providerEventId ||
      block.title !== title ||
      block.startIso.getTime() !== slot.start.getTime() ||
      block.endIso.getTime() !== slot.end.getTime();

    if (shouldUpdateCalendar) {
      let providerEventId = block.providerEventId ?? null;
      let calendarWriteFailed = false;

      try {
        providerEventId = await googleCreateOrUpdateFocusEvent({
          existingEventId: block.providerEventId ?? undefined,
          title,
          startIso: slot.start.toISOString(),
          endIso: slot.end.toISOString(),
          focusBlockId: block.id,
          leverCategory: lever.category,
        });
      } catch (error) {
        calendarWriteFailed = true;
        console.error("Google Calendar write failed:", error);

        await queueCalendarWrite({
          actionType: "create_or_update_focus_event",
          payload: {
            focusBlockId: block.id,
            existingEventId: block.providerEventId ?? null,
            title,
            startIso: slot.start.toISOString(),
            endIso: slot.end.toISOString(),
            leverCategory: lever.category,
          },
          error,
        });
      }

      block = await prisma.focusBlock.update({
        where: { id: block.id },
        data: {
          provider: "google",
          providerEventId: providerEventId ?? null,
          title,
          startIso: slot.start,
          endIso: slot.end,
          status: calendarWriteFailed ? "cancelled" : "scheduled",
          leverCategory: lever.category,
          predictedImpact: lever.predictedImpact,
          confidence,
        },
      });

      const action = await prisma.actionsLog.create({
        data: {
          userId: DEMO_USER_ID,
          actionType: existing ? "update_focus_block" : "reserve_block",
          payload: {
            blockId: block.id,
            providerEventId,
            title,
            startIso: slot.start.toISOString(),
            endIso: slot.end.toISOString(),
            adaptive: {
              dynamicDuration,
              completionRate: signals.completionRate,
              missRate: signals.missRate,
              needleMoverRate: signals.needleMoverRate,
              confidence,
            },
            calendarWriteFailed,
          },
          undoPayload: {
            providerEventId,
            focusBlockId: block.id,
            operation: providerEventId ? "delete_google_event" : "cancel_focus_block",
          },
        },
      });

      actionId = action.id;

      if (calendarWriteFailed) {
        reservationStatus = "queued";
        isReserved = false;

        await trackEvent("calendar_write_queued", {
          blockId: block.id,
          reason: "Google Calendar write failed.",
        });
      } else {
        reservationStatus = "reserved";
        isReserved = true;

        await trackEvent("block_reserved_silent", {
          blockId: block.id,
          provider: "google",
          updatedExisting: Boolean(existing),
        });
      }
    } else {
      const latestAction = await prisma.actionsLog.findFirst({
        where: {
          userId: DEMO_USER_ID,
          status: "applied",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      actionId = latestAction?.id ?? "";
      reservationStatus = "reserved";
      isReserved = true;
    }
  } else {
    block = await prisma.focusBlock.update({
      where: { id: block.id },
      data: {
        provider: "local",
        title,
        startIso: slot.start,
        endIso: slot.end,
        status: block.status === "started" ? "started" : "cancelled",
        leverCategory: lever.category,
        predictedImpact: lever.predictedImpact,
        confidence,
      },
    });

    const action = await prisma.actionsLog.create({
      data: {
        userId: DEMO_USER_ID,
        actionType: rules.calendarConnected
          ? "create_suggested_block"
          : "calendar_reconnect_required",
        payload: {
          blockId: block.id,
          title,
          startIso: slot.start.toISOString(),
          endIso: slot.end.toISOString(),
          reason: rules.calendarConnected
            ? "Calendar is read-only or protection is disabled."
            : "Calendar is not connected.",
          adaptive: {
            dynamicDuration,
            completionRate: signals.completionRate,
            missRate: signals.missRate,
            needleMoverRate: signals.needleMoverRate,
            confidence,
          },
        },
        undoPayload: {
          dismissSuggestion: true,
          focusBlockId: block.id,
        },
      },
    });

    actionId = action.id;
    reservationStatus = "suggested";
    isReserved = false;
  }

  const plan = buildPlan({
    block,
    lever,
    actionId,
    confidence,
    reservationStatus,
    isReserved,
    calendarReconnectRequired: !rules.calendarConnected,
    readOnlyCalendar: rules.calendarPermission === "read-only",
    why: planner.why,
    plan: planner.plan,
  });

  await trackEvent("wake_sentence_shown", {
    wakePlanId: plan.id,
    source: "backend",
  });

  await trackEvent("wake_plan_refreshed", {
    wakePlanId: plan.id,
    force,
    reusedExistingBlock: Boolean(existing),
    adaptive: {
      dynamicDuration,
      completionRate: signals.completionRate,
      missRate: signals.missRate,
      needleMoverRate: signals.needleMoverRate,
      confidence,
    },
  });

  return plan;
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
    providerEventId?: string;
    focusBlockId?: string;
    operation?: string;
    eventId?: string;
    oldStartIso?: string;
    oldEndIso?: string;
  };

  if (undo.providerEventId && undo.operation === "delete_google_event") {
    await googleDeleteEvent(undo.providerEventId);
  }

  if (undo.eventId && undo.operation === "move_google_event_back") {
    if (!undo.oldStartIso || !undo.oldEndIso) {
      throw new Error("Missing original event time for flex shift undo.");
    }

    const { googleMoveEvent } = await import("./google");

    await googleMoveEvent({
      eventId: undo.eventId,
      startIso: undo.oldStartIso,
      endIso: undo.oldEndIso,
      reason: "Undo Focus20 flex shift",
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

  await trackEvent("undo_used", { actionId });

  return { success: true };
}

export async function updatePatternFromFeedback(input: {
  focusBlockId: string;
  result: string;
  needleMover: string;
}) {
  const block = await prisma.focusBlock.findUnique({
    where: { id: input.focusBlockId },
  });

  if (!block) return null;

  const profile = await defaultPattern();

  const delta = scoreDelta(input.result, input.needleMover);
  const category = block.leverCategory as LeverCategory;
  const windowKey = getWindowKey(block.startIso);

  const leverRankings = profile.leverRankings as Array<{
    category: LeverCategory;
    score: number;
  }>;

  const bestWindows = profile.bestWindows as Array<{
    start: string;
    end: string;
    score: number;
    key?: string;
  }>;

  const updatedLeverRankings = leverRankings.map((item) => {
    if (item.category !== category) return item;

    return {
      ...item,
      score: clampScore(item.score + delta),
    };
  });

  const updatedBestWindows = bestWindows.map((window) => {
    const startHour = Number(window.start.split(":")[0]);

    let key = "evening";
    if (startHour < 10) key = "early_morning";
    else if (startHour < 12) key = "late_morning";
    else if (startHour < 15) key = "early_afternoon";
    else if (startHour < 18) key = "late_afternoon";

    if (key !== windowKey) return window;

    return {
      ...window,
      score: clampScore(window.score + delta),
    };
  });

  return prisma.patternProfile.update({
    where: { userId: DEMO_USER_ID },
    data: {
      leverRankings: updatedLeverRankings,
      bestWindows: updatedBestWindows,
      frictionSignals: {
        lastFeedback: {
          focusBlockId: input.focusBlockId,
          result: input.result,
          needleMover: input.needleMover,
          delta,
          category,
          windowKey,
          updatedAt: new Date().toISOString(),
        },
      },
    },
  });
}

export async function recordCheckin(input: {
  focusBlockId?: string;
  result: string;
  needleMover: string;
  noteText?: string;
}) {
  await ensureDemoUser();

  let focusBlock = input.focusBlockId
    ? await prisma.focusBlock.findUnique({
        where: { id: input.focusBlockId },
      })
    : null;

  if (!focusBlock) {
    const plan = await refreshWakePlan(true);

    focusBlock = await prisma.focusBlock.findUnique({
      where: { id: plan.block.id },
    });
  }

  if (!focusBlock) {
    throw new Error("No FocusBlock found or created for feedback.");
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId: DEMO_USER_ID,
      focusBlockId: focusBlock.id,
      result: input.result,
      needleMover: input.needleMover,
      noteText: input.noteText ?? null,
    },
  });

  const status = input.result === "missed" ? "missed" : "completed";

  await prisma.focusBlock.update({
    where: { id: focusBlock.id },
    data: { status },
  });

  await updatePatternFromFeedback({
    focusBlockId: focusBlock.id,
    result: input.result,
    needleMover: input.needleMover,
  });

  if (status === "completed") {
    await prisma.user.update({
      where: { id: DEMO_USER_ID },
      data: { completedFirstLever: true },
    });
  }

  await trackEvent("voice_checkin_used", {
    focusBlockId: focusBlock.id,
    result: input.result,
  });

  await trackEvent("needle_mover_feedback_recorded", {
    focusBlockId: focusBlock.id,
    needleMover: input.needleMover,
  });

  await trackEvent("block_completed", {
    focusBlockId: focusBlock.id,
    status,
  });

  return feedback;
}

export async function listCalendarEvents(startIso: string, endIso: string) {
  await ensureDemoUser();

  const [blocks, busy] = await Promise.all([
    prisma.focusBlock.findMany({
      where: {
        userId: DEMO_USER_ID,
        startIso: {
          gte: new Date(startIso),
          lte: new Date(endIso),
        },
        status: {
          not: "cancelled",
        },
      },
      orderBy: {
        startIso: "asc",
      },
    }),
    googleFreeBusy(startIso, endIso).catch(() => []),
  ]);

  return [
    ...busy.map((item, index) => ({
      id: `google_busy_${index}`,
      title: "Busy",
      start: item.start,
      end: item.end,
      type: "meeting",
      busy: true,
    })),
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
  ];
}

export async function startFocusBlock(focusBlockId?: string) {
  await ensureDemoUser();

  let block = focusBlockId
    ? await prisma.focusBlock.findUnique({
        where: { id: focusBlockId },
      })
    : null;

  if (!block || block.status === "cancelled") {
    const plan = await refreshWakePlan(true);

    block = await prisma.focusBlock.findUnique({
      where: { id: plan.block.id },
    });
  }

  if (!block) {
    throw new Error("No FocusBlock found to start.");
  }

  const updated = await prisma.focusBlock.update({
    where: { id: block.id },
    data: {
      status: "started",
    },
  });

  await trackEvent("block_started", {
    focusBlockId: updated.id,
    providerEventId: updated.providerEventId ?? null,
  });

  return {
    ok: true,
    block: updated,
    shouldStartTimer: true,
  };
}

export async function canSendNotification() {
  await ensureDemoUser();

  const user = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
  });

  if (!user?.notificationsEnabled) {
    return { allowed: false, reason: "Notifications disabled." };
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
      userId: DEMO_USER_ID,
      name: "notification_sent",
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  });

  if (sentToday >= 2) {
    return { allowed: false, reason: "Daily notification limit reached." };
  }

  return { allowed: true, sentToday };
}

export async function logNotificationSent(input: {
  focusBlockId?: string;
  type: "pre_block_reminder" | "end_of_day_checkin";
}) {
  const check = await canSendNotification();

  if (!check.allowed) {
    return {
      ok: false,
      reason: check.reason,
    };
  }

  await trackEvent("notification_sent", {
    type: input.type,
    focusBlockId: input.focusBlockId ?? null,
  });

  await prisma.actionsLog.create({
    data: {
      userId: DEMO_USER_ID,
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

  return { ok: true };
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
  startIso: string;
  endIso: string;
}) {
  await ensureDemoUser();

  const rules = await getRules();

  if (!rules.flexShiftEnabled) {
    return {
      ok: false,
      reason: "Flex shift is not enabled.",
      candidates: [],
    };
  }

  const busy = await googleFreeBusy(input.startIso, input.endIso).catch(() => []);

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

      const newStart = new Date(oldEnd.getTime() + 30 * 60_000);
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

  await trackEvent("flex_shift_previewed", {
    candidateCount: candidates.length,
  });

  return {
    ok: true,
    candidates,
  };
}

export async function applyFlexShift(input: {
  eventId: string;
  title: string;
  oldStartIso: string;
  oldEndIso: string;
  newStartIso: string;
  newEndIso: string;
  reason?: string;
}) {
  await ensureDemoUser();

  const rules = await getRules();

  if (!rules.flexShiftEnabled) {
    return {
      ok: false,
      reason: "Flex shift is not enabled.",
    };
  }

  const { start, end } = todayRange();

  const movesToday = await prisma.actionsLog.count({
    where: {
      userId: DEMO_USER_ID,
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

  if (!isFlexEventTitle(input.title)) {
    return {
      ok: false,
      reason: "Only FLEX-tagged events can be shifted.",
    };
  }

  if (isProtectedEventTitle(input.title)) {
    return {
      ok: false,
      reason: "Protected event types cannot be shifted.",
    };
  }

  const { googleMoveEvent } = await import("./google");

  const movedEventId = await googleMoveEvent({
    eventId: input.eventId,
    startIso: input.newStartIso,
    endIso: input.newEndIso,
    reason: input.reason ?? "Focus20 flex shift",
  });

  const action = await prisma.actionsLog.create({
    data: {
      userId: DEMO_USER_ID,
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

  await trackEvent("flex_event_shifted", {
    eventId: movedEventId,
    actionId: action.id,
  });

  return {
    ok: true,
    movedEventId,
    actionId: action.id,
  };
}