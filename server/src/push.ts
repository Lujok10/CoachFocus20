import { Prisma } from "@prisma/client";
import webpush from "web-push";
import { prisma, ensureUser } from "./db";
import { trackAnalytics } from "./analytics";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:support@focus20.app";
try {
  if (publicKey && privateKey) {
    webpush.setVapidDetails(
      subject,
      publicKey.trim(),
      privateKey.trim()
    );
  }
} catch (error) {
  console.error(
    "Invalid VAPID configuration. Push notifications disabled.",
    error
  );
}
type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function endOfToday() {
  const end = startOfToday();
  end.setDate(end.getDate() + 1);
  return end;
}

function isQuietHour(
  date: Date,
  quietStartHour: number,
  quietEndHour: number
) {
  const hour = date.getHours();

  if (quietStartHour > quietEndHour) {
    return hour >= quietStartHour || hour < quietEndHour;
  }

  return hour >= quietStartHour && hour < quietEndHour;
}

function nextQuietEnd(date: Date, quietEndHour: number) {
  const next = new Date(date);
  next.setHours(quietEndHour, 0, 0, 0);

  if (next <= date) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

export async function ensureNotificationPreference(userId: string) {
  await ensureUser(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  return prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      timezone: user?.timezone ?? "America/New_York",
      quietHoursEnabled: true,
      quietStartHour: 22,
      quietEndHour: 7,
      maxPerDay: 2,
    },
  });
}

export async function savePushSubscription(
  userId: string,
  input: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }
) {
  await ensureUser(userId);
  await ensureNotificationPreference(userId);

  if (!input.endpoint || !input.keys?.p256dh || !input.keys?.auth) {
    throw new Error("Invalid push subscription.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      notificationsEnabled: true,
    },
  });

  return prisma.pushSubscription.upsert({
    where: {
      endpoint: input.endpoint,
    },
    update: {
      userId,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    },
  });
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  await ensureUser(userId);

  await prisma.pushSubscription.deleteMany({
    where: {
      userId,
      endpoint,
    },
  });

  const remaining = await prisma.pushSubscription.count({
    where: { userId },
  });

  if (remaining === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        notificationsEnabled: false,
      },
    });
  }

  return { ok: true };
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID keys.");
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const results = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      );

      results.push({
        endpoint: sub.endpoint,
        ok: true,
      });
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await prisma.pushSubscription.delete({
          where: { id: sub.id },
        });
      }

      results.push({
        endpoint: sub.endpoint,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await trackAnalytics(userId, "notification_sent", {
    title: payload.title,
    tag: payload.tag ?? null,
    sentCount: results.filter((item) => item.ok).length,
  });

  return {
    sent: results.filter((item) => item.ok).length,
    results,
  };
}

export async function enqueueNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  scheduledFor: Date;
  url?: string;
  tag?: string;
  payload?: Record<string, unknown>;
}) {
  await ensureUser(input.userId);
  await ensureNotificationPreference(input.userId);

  return prisma.notificationJob.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      scheduledFor: input.scheduledFor,
      url: input.url ?? "/",
      tag: input.tag ?? input.type,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      status: "pending",
      retries: 0,
    },
  });
}

export async function scheduleFocusBlockNotifications(input: {
  userId: string;
  focusBlockId: string;
  title: string;
  startIso: string;
}) {
  const start = new Date(input.startIso);
  const reminderAt = new Date(start.getTime() - 10 * 60_000);

  if (reminderAt <= new Date()) {
    return {
      ok: true,
      skipped: true,
      reason: "Reminder time already passed.",
    };
  }

  await prisma.notificationJob.deleteMany({
    where: {
      userId: input.userId,
      type: "pre_block_reminder",
      tag: `focus_block_${input.focusBlockId}`,
      status: "pending",
    },
  });

  await enqueueNotification({
    userId: input.userId,
    type: "pre_block_reminder",
    title: "Focus20 block starts soon",
    body: `${input.title} starts in 10 minutes.`,
    scheduledFor: reminderAt,
    url: "/",
    tag: `focus_block_${input.focusBlockId}`,
    payload: {
      focusBlockId: input.focusBlockId,
    },
  });

  return { ok: true };
}

export async function scheduleEndOfDayCheckin(userId: string) {
  const now = new Date();
  const scheduledFor = new Date(now);
  scheduledFor.setHours(19, 0, 0, 0);

  if (scheduledFor <= now) {
    scheduledFor.setDate(scheduledFor.getDate() + 1);
  }

  await prisma.notificationJob.deleteMany({
    where: {
      userId,
      type: "end_of_day_checkin",
      status: "pending",
      scheduledFor: {
        gte: startOfToday(),
        lt: endOfToday(),
      },
    },
  });

  return enqueueNotification({
    userId,
    type: "end_of_day_checkin",
    title: "Quick Focus20 check-in",
    body: "Did your protected block move the needle today?",
    scheduledFor,
    url: "/",
    tag: "end_of_day_checkin",
  });
}

export async function processNotificationQueue(limit = 25) {
  const now = new Date();

  const jobs = await prisma.notificationJob.findMany({
    where: {
      status: "pending",
      scheduledFor: {
        lte: now,
      },
      retries: {
        lt: 5,
      },
    },
    orderBy: {
      scheduledFor: "asc",
    },
    take: limit,
  });

  const results = [];

  for (const job of jobs) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: job.userId },
      });

      if (!user?.notificationsEnabled) {
        await prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: "cancelled",
            lastError: "Notifications disabled.",
          },
        });

        results.push({
          id: job.id,
          ok: false,
          cancelled: true,
        });

        continue;
      }

      if (!user.completedFirstLever) {
        await prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: "cancelled",
            lastError: "First lever not completed.",
          },
        });

        results.push({
          id: job.id,
          ok: false,
          cancelled: true,
        });

        continue;
      }

      const preference = await ensureNotificationPreference(job.userId);

      const sentToday = await prisma.notificationJob.count({
        where: {
          userId: job.userId,
          status: "sent",
          sentAt: {
            gte: startOfToday(),
            lt: endOfToday(),
          },
        },
      });

      if (sentToday >= preference.maxPerDay) {
        await prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: "cancelled",
            lastError: "Daily notification limit reached.",
          },
        });

        results.push({
          id: job.id,
          ok: false,
          cancelled: true,
        });

        continue;
      }

      if (
        preference.quietHoursEnabled &&
        isQuietHour(now, preference.quietStartHour, preference.quietEndHour)
      ) {
        await prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            scheduledFor: nextQuietEnd(now, preference.quietEndHour),
            lastError: "Deferred due to quiet hours.",
          },
        });

        results.push({
          id: job.id,
          ok: true,
          deferred: true,
        });

        continue;
      }

      const sendResult = await sendPushToUser(job.userId, {
        title: job.title,
        body: job.body,
        url: job.url ?? "/",
        tag: job.tag ?? job.type,
      });

      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: sendResult.sent > 0 ? "sent" : "failed",
          sentAt: sendResult.sent > 0 ? new Date() : null,
          retries: job.retries + 1,
          lastError: sendResult.sent > 0 ? null : "No active subscriptions.",
        },
      });

      results.push({
        id: job.id,
        ok: sendResult.sent > 0,
        sent: sendResult.sent,
      });
    } catch (error) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          retries: job.retries + 1,
          status: job.retries + 1 >= 5 ? "failed" : "pending",
          scheduledFor: new Date(
            Date.now() + (job.retries + 1) * 5 * 60_000
          ),
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