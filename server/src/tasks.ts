import { prisma, ensureUser } from "./db";
import {
  googleCreateOrUpdateFocusEvent,
  googleDeleteEvent,
} from "./google";

type ScheduleInput = {
  startIso?: string;
  endIso?: string;
  durationMinutes?: number;
  addToCalendar?: boolean;
  protectAsFocus?: boolean;
};

function computeEnd(start: Date, durationMinutes = 60) {
  return new Date(start.getTime() + durationMinutes * 60_000);
}

export async function createTask(
  userId: string,
  input: {
    title?: string;
    category?: string;
    notes?: string;
    dueDateIso?: string;
    startIso?: string;
    endIso?: string;
    protectAsFocus?: boolean;
  }
) {
  await ensureUser(userId);

  if (!input.title?.trim()) {
    throw new Error("Task title is required.");
  }

  return prisma.task.create({
    data: {
      userId,
      title: input.title.trim(),
      category: input.category ?? "admin",
      notes: input.notes ?? null,
      dueDateIso: input.dueDateIso
        ? new Date(input.dueDateIso)
        : null,
      startIso: input.startIso
        ? new Date(input.startIso)
        : null,
      endIso: input.endIso
        ? new Date(input.endIso)
        : null,
      protectAsFocus: Boolean(input.protectAsFocus),
      status: input.startIso
        ? "scheduled"
        : "unscheduled",
    },
  });
}

export async function listTasks(userId: string) {
  await ensureUser(userId);

  return prisma.task.findMany({
    where: {
      userId,
    },
    orderBy: [
      { startIso: "asc" },
      { createdAt: "desc" },
    ],
  });
}

export async function scheduleTask(
  userId: string,
  taskId: string,
  input: ScheduleInput
) {
  await ensureUser(userId);

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  const start = input.startIso
    ? new Date(input.startIso)
    : task.startIso ?? new Date();

  const end = input.endIso
    ? new Date(input.endIso)
    : task.endIso ?? computeEnd(start, input.durationMinutes ?? 60);

  let provider = task.provider;
  let providerEventId = task.providerEventId;

  if (input.addToCalendar) {
    providerEventId = await googleCreateOrUpdateFocusEvent({
      userId,
      existingEventId: task.providerEventId ?? undefined,
      title: input.protectAsFocus ? `Focus 20: ${task.title}` : task.title,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      focusBlockId: task.id,
      leverCategory: task.category ?? "admin",
    });

    provider = "google";
  }

  const updated = await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      startIso: start,
      endIso: end,
      provider,
      providerEventId,
      status: "scheduled",
      protectAsFocus: input.protectAsFocus ?? task.protectAsFocus,
    },
  });

  const action = await prisma.actionsLog.create({
    data: {
      userId,
      actionType: "schedule_task",
      payload: {
        taskId,
        title: updated.title,
        providerEventId,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      },
      undoPayload: {
        taskId,
        providerEventId,
        operation: providerEventId ? "delete_google_event" : "unschedule_task",
      },
    },
  });

  return {
    ok: true,
    task: updated,
    actionId: action.id,
  };
}

export async function undoTaskSchedule(
  userId: string,
  taskId: string
) {
  await ensureUser(userId);

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  if (task.providerEventId) {
    await googleDeleteEvent(userId, task.providerEventId);
  }

  const updated = await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      provider: "local",
      providerEventId: null,
      startIso: null,
      endIso: null,
      status: "unscheduled",
    },
  });

  await prisma.actionsLog.create({
    data: {
      userId,
      actionType: "undo_task_schedule",
      payload: { taskId },
      undoPayload: { notUndoable: true },
      status: "undone",
    },
  });

  return {
    ok: true,
    task: updated,
  };
}