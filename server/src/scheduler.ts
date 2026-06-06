import { prisma, ensureUser } from "./db";
import { googleFreeBusy } from "./google";

type BusyItem = {
  start?: string | null;
  end?: string | null;
};

type SchedulerInput = {
  userId: string;
  durationMinutes?: number;
  preferredDateIso?: string;
  category?: string;
  includeGoogleBusy?: boolean;
};

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function parseBusy(items: BusyItem[]) {
  return items
    .map((item) => ({
      start: new Date(item.start ?? ""),
      end: new Date(item.end ?? ""),
    }))
    .filter(
      (item) =>
        !Number.isNaN(item.start.getTime()) &&
        !Number.isNaN(item.end.getTime())
    );
}

function defaultWindowsForDate(date: Date) {
  const configs = [
    { start: "09:30", end: "10:30", score: 0.78 },
    { start: "11:00", end: "12:00", score: 0.72 },
    { start: "14:00", end: "15:00", score: 0.62 },
    { start: "16:00", end: "17:00", score: 0.52 },
  ];

  return configs.map((item) => {
    const [startHour, startMinute] = item.start.split(":").map(Number);
    const [endHour, endMinute] = item.end.split(":").map(Number);

    const start = new Date(date);
    start.setHours(startHour, startMinute, 0, 0);

    const end = new Date(date);
    end.setHours(endHour, endMinute, 0, 0);

    return {
      start,
      end,
      score: item.score,
    };
  });
}

function generateCandidateSlots(
  date: Date,
  durationMinutes: number,
  stepMinutes = 30
) {
  const slots = [];

  const dayStart = new Date(date);
  dayStart.setHours(8, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(20, 0, 0, 0);

  let cursor = new Date(dayStart);

  while (addMinutes(cursor, durationMinutes) <= dayEnd) {
    slots.push({
      start: new Date(cursor),
      end: addMinutes(cursor, durationMinutes),
      score: 0,
      reasons: [] as string[],
    });

    cursor = addMinutes(cursor, stepMinutes);
  }

  return slots;
}

async function getLocalBusy(userId: string, dayStart: Date, dayEnd: Date) {
  const [blocks, tasks] = await Promise.all([
    prisma.focusBlock.findMany({
      where: {
        userId,
        status: {
          not: "cancelled",
        },
        startIso: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    }),

    prisma.task.findMany({
      where: {
        userId,
        status: {
          not: "unscheduled",
        },
        startIso: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    }),
  ]);

  return [
    ...blocks.map((block) => ({
      start: block.startIso,
      end: block.endIso,
    })),

    ...tasks
      .filter((task) => task.startIso && task.endIso)
      .map((task) => ({
        start: task.startIso as Date,
        end: task.endIso as Date,
      })),
  ];
}

async function getCapacity(userId: string, dayStart: Date, dayEnd: Date) {
  const [scheduledBlocks, scheduledTasks] = await Promise.all([
    prisma.focusBlock.count({
      where: {
        userId,
        status: {
          in: ["scheduled", "started", "completed"],
        },
        startIso: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    }),

    prisma.task.count({
      where: {
        userId,
        status: {
          in: ["scheduled", "started", "completed"],
        },
        startIso: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    }),
  ]);

  return {
    scheduledBlocks,
    scheduledTasks,
    totalScheduled: scheduledBlocks + scheduledTasks,
  };
}

async function getPatternWindows(userId: string, date: Date) {
  const profile = await prisma.patternProfile.findUnique({
    where: { userId },
  });

  const windows = profile?.bestWindows as
    | Array<{ start: string; end: string; score: number }>
    | undefined;

  if (!windows?.length) {
    return defaultWindowsForDate(date);
  }

  return windows.slice(0, 5).map((window) => {
    const [startHour, startMinute] = String(window.start).split(":").map(Number);
    const [endHour, endMinute] = String(window.end).split(":").map(Number);

    const start = new Date(date);
    start.setHours(startHour || 9, startMinute || 30, 0, 0);

    const end = new Date(date);
    end.setHours(endHour || 10, endMinute || 30, 0, 0);

    return {
      start,
      end,
      score: Number(window.score) || 0.6,
    };
  });
}

function scoreSlot(input: {
  slot: {
    start: Date;
    end: Date;
    score: number;
    reasons: string[];
  };
  busy: Array<{ start: Date; end: Date }>;
  patternWindows: Array<{ start: Date; end: Date; score: number }>;
  buffersMinutes: number;
  now: Date;
  capacity: {
    scheduledBlocks: number;
    scheduledTasks: number;
    totalScheduled: number;
  };
}) {
  const { slot, busy, patternWindows, buffersMinutes, now, capacity } = input;

  let score = 50;
  const reasons: string[] = [];

  if (slot.start < now) {
    return {
      ...slot,
      score: -999,
      reasons: ["Past slot"],
    };
  }

  const bufferedStart = addMinutes(slot.start, -buffersMinutes);
  const bufferedEnd = addMinutes(slot.end, buffersMinutes);

  const hasConflict = busy.some((item) =>
    overlaps(bufferedStart, bufferedEnd, item.start, item.end)
  );

  if (hasConflict) {
    return {
      ...slot,
      score: -999,
      reasons: ["Conflicts with existing schedule or buffer"],
    };
  }

  score += 25;
  reasons.push("No conflicts with buffer");

  const matchingWindow = patternWindows.find((window) =>
    overlaps(slot.start, slot.end, window.start, window.end)
  );

  if (matchingWindow) {
    const boost = Math.round(matchingWindow.score * 25);
    score += boost;
    reasons.push("Matches learned high-energy window");
  } else {
    score -= 8;
  }

  const hour = slot.start.getHours();

  if (hour >= 9 && hour <= 12) {
    score += 8;
    reasons.push("Strong morning execution window");
  }

  if (hour >= 13 && hour <= 16) {
    score += 4;
    reasons.push("Usable afternoon focus window");
  }

  if (hour >= 18) {
    score -= 12;
    reasons.push("Late-day slot has higher miss risk");
  }

  if (capacity.scheduledBlocks >= 2) {
    score -= 30;
    reasons.push("Daily focus capacity is already high");
  } else if (capacity.scheduledBlocks === 1) {
    score -= 10;
    reasons.push("Second focus block today");
  } else {
    score += 10;
    reasons.push("Within daily focus capacity");
  }

  if (capacity.totalScheduled >= 6) {
    score -= 15;
    reasons.push("Calendar density is high today");
  }

  return {
    ...slot,
    score,
    reasons,
  };
}

export async function chooseSmartSlot(input: SchedulerInput) {
  await ensureUser(input.userId);

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  const now = new Date();

  const targetDate = input.preferredDateIso
    ? new Date(input.preferredDateIso)
    : now;

  const durationMinutes = input.durationMinutes ?? 60;
  const buffersMinutes = user?.buffersMinutes ?? 10;

  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  const [localBusy, capacity, patternWindows] = await Promise.all([
    getLocalBusy(input.userId, dayStart, dayEnd),
    getCapacity(input.userId, dayStart, dayEnd),
    getPatternWindows(input.userId, targetDate),
  ]);

  let googleBusy: Array<{ start: Date; end: Date }> = [];

  if (input.includeGoogleBusy && user?.calendarConnected) {
    const busy = await googleFreeBusy(
      input.userId,
      dayStart.toISOString(),
      dayEnd.toISOString()
    ).catch(() => []);

    googleBusy = parseBusy(busy);
  }

  const busy = [...localBusy, ...googleBusy];

  const candidates = generateCandidateSlots(
    targetDate,
    durationMinutes
  ).map((slot) =>
    scoreSlot({
      slot,
      busy,
      patternWindows,
      buffersMinutes,
      now,
      capacity,
    })
  );

  const viable = candidates
    .filter((slot) => slot.score > -999)
    .sort((a, b) => b.score - a.score);

  const chosen =
    viable[0] ??
    ({
      start: addMinutes(now, 15),
      end: addMinutes(now, 15 + Math.min(durationMinutes, 30)),
      score: 25,
      reasons: ["No ideal slot found, using smallest viable fallback"],
    } as {
      start: Date;
      end: Date;
      score: number;
      reasons: string[];
    });

  return {
    start: chosen.start,
    end: chosen.end,
    score: chosen.score,
    reasons: chosen.reasons,
    candidates: viable.slice(0, 5).map((slot) => ({
      startIso: slot.start.toISOString(),
      endIso: slot.end.toISOString(),
      score: slot.score,
      reasons: slot.reasons,
    })),
    capacity,
  };
}