export type SchedulerEvent = {
  id: string;
  title?: string;
  summary?: string;
  start?: string | Date;
  end?: string | Date;
  startIso?: string | Date;
  endIso?: string | Date;
  type?: "focus" | "task" | "calendar";
  isFocusBlock?: boolean;
  protectAsFocus?: boolean;
  providerEventId?: string | null;
  category?: string;
  leverCategory?: string;
};

export type CalendarRecommendation = {
  title: string;
  start: Date;
  end: Date;
  confidence: number;
  reasons: string[];
  alternatives: Array<{
    start: Date;
    end: Date;
    confidence: number;
    reason: string;
  }>;
};

export type DayOptimization = {
  confidence: number;
  predictedGain: number;
  movedEvents: Array<{
    title: string;
    from: Date;
    to: Date;
  }>;
  reservedBlock: CalendarRecommendation | null;
  warnings: string[];
};

export function schedulerEventStart(event: SchedulerEvent) {
  return new Date(event.start ?? event.startIso ?? Date.now());
}

export function schedulerEventEnd(event: SchedulerEvent) {
  return new Date(event.end ?? event.endIso ?? Date.now());
}

export function schedulerEventTitle(event: SchedulerEvent) {
  return event.title ?? event.summary ?? "Untitled";
}

export function schedulerEventType(event: SchedulerEvent) {
  if (event.type) return event.type;
  if (event.isFocusBlock || event.protectAsFocus) return "focus";
  return "task";
}

export function sameCalendarDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export function addSchedulerMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function getBestFocusWindow(
  events: SchedulerEvent[],
  currentDate: Date
): CalendarRecommendation | null {
  const sortedEvents = [...events].sort(
    (a, b) => schedulerEventStart(a).getTime() - schedulerEventStart(b).getTime()
  );

  const dayStart = new Date(currentDate);
  dayStart.setHours(8, 0, 0, 0);

  const dayEnd = new Date(currentDate);
  dayEnd.setHours(20, 0, 0, 0);

  const candidates: CalendarRecommendation["alternatives"] = [];
  let cursor = new Date(dayStart);

  for (const event of sortedEvents) {
    const start = schedulerEventStart(event);
    const end = schedulerEventEnd(event);

    if (!sameCalendarDay(start, currentDate)) continue;

    if (cursor < start) {
      const gapMinutes = Math.round(
        (start.getTime() - cursor.getTime()) / 60000
      );

      if (gapMinutes >= 60) {
        const slotStart = new Date(cursor);
        const slotEnd = addSchedulerMinutes(slotStart, Math.min(90, gapMinutes));

        const isMorning = slotStart.getHours() < 12;
        const hasBuffer = gapMinutes >= 75;

        candidates.push({
          start: slotStart,
          end: slotEnd,
          confidence: Math.min(
            95,
            65 + (isMorning ? 15 : 0) + (hasBuffer ? 15 : 0)
          ),
          reason: isMorning
            ? "Morning window with fewer expected interruptions."
            : "Open calendar gap with enough room for focused work.",
        });
      }
    }

    if (end > cursor) {
      cursor = new Date(end);
    }
  }

  if (cursor < dayEnd) {
    const gapMinutes = Math.round(
      (dayEnd.getTime() - cursor.getTime()) / 60000
    );

    if (gapMinutes >= 60) {
      const slotStart = new Date(cursor);
      const slotEnd = addSchedulerMinutes(slotStart, Math.min(90, gapMinutes));

      candidates.push({
        start: slotStart,
        end: slotEnd,
        confidence: Math.min(90, 60 + (slotStart.getHours() < 12 ? 15 : 0)),
        reason: "End-of-day open window available for focused work.",
      });
    }
  }

  const ranked = candidates.sort((a, b) => b.confidence - a.confidence);
  const best = ranked[0];

  if (!best) return null;

  return {
    title: "Best Deep Work Window",
    start: best.start,
    end: best.end,
    confidence: best.confidence,
    reasons: [
      best.reason,
      "Avoids calendar conflicts.",
      "Leaves room for protected focus instead of fragmented task switching.",
    ],
    alternatives: ranked.slice(1, 3),
  };
}

export function optimizeDay(
  events: SchedulerEvent[],
  currentDate: Date,
  existingRecommendation?: CalendarRecommendation | null
): DayOptimization {
  const recommendation =
    existingRecommendation ?? getBestFocusWindow(events, currentDate);

  const flexEvents = events.filter(
    (event) =>
      schedulerEventType(event) !== "focus" &&
      (event.category === "flex" ||
        event.leverCategory === "flex" ||
        schedulerEventTitle(event).toLowerCase().includes("flex"))
  );

  const movedEvents = flexEvents.slice(0, 2).map((event, index) => ({
    title: schedulerEventTitle(event),
    from: schedulerEventStart(event),
    to: addSchedulerMinutes(schedulerEventStart(event), (index + 1) * 30),
  }));

  return {
    confidence: recommendation ? Math.min(99, recommendation.confidence + 2) : 80,
    predictedGain: recommendation ? Math.round(recommendation.confidence / 5) : 10,
    movedEvents,
    reservedBlock: recommendation,
    warnings:
      movedEvents.length === 0 ? ["No FLEX events available to optimize."] : [],
  };
}