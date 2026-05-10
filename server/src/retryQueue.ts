import { prisma, DEMO_USER_ID, ensureDemoUser } from "./db";
import { googleCreateOrUpdateFocusEvent } from "./google";

export async function queueCalendarWrite(input: {
  actionType: "create_or_update_focus_event";
  payload: {
    focusBlockId: string;
    existingEventId?: string | null;
    title: string;
    startIso: string;
    endIso: string;
    leverCategory: string;
  };
  error?: unknown;
}) {
  await ensureDemoUser();

  return prisma.calendarWriteQueue.create({
    data: {
      userId: DEMO_USER_ID,
      actionType: input.actionType,
      payload: input.payload,
      status: "queued",
      attempts: 0,
      lastError:
        input.error instanceof Error
          ? input.error.message
          : input.error
            ? String(input.error)
            : null,
    },
  });
}

export async function retryCalendarWrites(limit = 10) {
  await ensureDemoUser();

  const queued = await prisma.calendarWriteQueue.findMany({
    where: {
      userId: DEMO_USER_ID,
      status: "queued",
      attempts: {
        lt: 5,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  const results = [];

  for (const item of queued) {
    try {
      const payload = item.payload as {
        focusBlockId: string;
        existingEventId?: string | null;
        title: string;
        startIso: string;
        endIso: string;
        leverCategory: string;
      };

      if (item.actionType !== "create_or_update_focus_event") {
        throw new Error(`Unsupported queued action: ${item.actionType}`);
      }

      const providerEventId = await googleCreateOrUpdateFocusEvent({
        existingEventId: payload.existingEventId ?? undefined,
        title: payload.title,
        startIso: payload.startIso,
        endIso: payload.endIso,
        focusBlockId: payload.focusBlockId,
        leverCategory: payload.leverCategory,
      });

      await prisma.focusBlock.update({
        where: {
          id: payload.focusBlockId,
        },
        data: {
          provider: "google",
          providerEventId,
          status: "scheduled",
        },
      });

      await prisma.calendarWriteQueue.update({
        where: {
          id: item.id,
        },
        data: {
          status: "completed",
          attempts: item.attempts + 1,
          lastError: null,
        },
      });

      results.push({
        id: item.id,
        ok: true,
        providerEventId,
      });
    } catch (error) {
      await prisma.calendarWriteQueue.update({
        where: {
          id: item.id,
        },
        data: {
          attempts: item.attempts + 1,
          lastError: error instanceof Error ? error.message : String(error),
          status: item.attempts + 1 >= 5 ? "failed" : "queued",
        },
      });

      results.push({
        id: item.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    processed: results.length,
    results,
  };
}
