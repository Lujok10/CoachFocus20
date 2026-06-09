import { Prisma } from "@prisma/client";
import { prisma, ensureUser } from "./db";
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from "./google";

export async function enqueueCalendarWrite(input: {
  userId: string;
  operation: "create_event" | "delete_event";
  payload: Record<string, unknown>;
  lastError?: string;
}) {
  await ensureUser(input.userId);

  return prisma.calendarWriteJob.create({
    data: {
      userId: input.userId,
      operation: input.operation,
      payload: input.payload as Prisma.InputJsonValue,
      lastError: input.lastError ?? null,
      status: "pending",
    },
  });
}

export async function processCalendarWriteQueue(limit = 20) {
  const jobs = await prisma.calendarWriteJob.findMany({
    where: {
      status: "pending",
      retries: {
        lt: 5,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  const results = [];

  for (const job of jobs) {
    try {
      if (job.operation === "create_event") {
        await createGoogleCalendarEvent(
          job.userId,
          job.payload as any
        );
      }

      if (job.operation === "delete_event") {
        await deleteGoogleCalendarEvent(
          job.userId,
          String((job.payload as any).providerEventId)
        );
      }

      await prisma.calendarWriteJob.update({
        where: { id: job.id },
        data: {
          status: "sent",
          lastError: null,
        },
      });

      results.push({ id: job.id, ok: true });
    } catch (error) {
      await prisma.calendarWriteJob.update({
        where: { id: job.id },
        data: {
          retries: job.retries + 1,
          status: job.retries + 1 >= 5 ? "failed" : "pending",
          lastError: error instanceof Error ? error.message : String(error),
        },
      });

      results.push({
        id: job.id,
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