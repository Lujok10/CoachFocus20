import "dotenv/config";

import cors from "cors";
import express from "express";
import { clerkMiddleware } from "@clerk/express";

import { prisma, ensureDemoUser, ensureUser } from "./db";
import { validateEnv } from "./env";
import { getRequestUserId } from "./auth";
import multer from "multer";
import fs from "fs";
import { transcribeAndAnalyzeAudio } from "./voice";


import {
  applyFlexShift,
  canSendNotification,
  getRules,
  listCalendarEvents,
  logNotificationSent,
  previewFlexShift,
  recordCheckin,
  refreshWakePlan,
  startFocusBlock,
  trackEvent,
  undoAction,
  updateRules,
} from "./coach";

import { getGoogleAuthUrl, handleGoogleCallback } from "./google";
import { getWeeklyInsights } from "./insights";
import { retryCalendarWrites } from "./retryQueue";
import { getAdminAnalytics } from "./adminAnalytics";
import {
  createTask,
  listTasks,
  scheduleTask,
  undoTaskSchedule,
} from "./tasks";

import {
  clearUserHistory,
  disconnectGoogleCalendar,
  resetPatternProfile,
} from "./userControls";

import {
  savePushSubscription,
  deletePushSubscription,
  sendPushToUser,
  processNotificationQueue,
  scheduleEndOfDayCheckin,
} from "./push";

import {
  getRecoverySuggestion,
  autoRescheduleMissedWork,
} from "./recovery";

const env = validateEnv();

const PORT = env.apiPort;
const CLIENT_URL = env.clientUrl;

const app = express();

const allowedOrigins = [
  CLIENT_URL,
  process.env.CLIENT_URL,
  process.env.FRONTEND_ORIGIN,
  "https://coach-focus20.vercel.app",
  "https://coach-focus20-hisa908gf-noel-nyirenda-s-projects.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
].filter(Boolean) as string[];

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);

    return url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://coach-focus20.vercel.app",
    ],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-admin-secret",
      "x-cron-secret",
    ],
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
  })
);

app.options("/{*splat}", cors());

app.use(
  clerkMiddleware({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    audience: "focus20-api",
  })
);
app.post(
  "/api/voice/checkin",
  upload.single("audio"),
  async (req, res, next) => {
    try {
      const focusBlockId = String(req.body?.focusBlockId ?? "");

      if (!focusBlockId) {
        res.status(400).json({
          ok: false,
          error: "Missing focusBlockId.",
        });
        return;
      }

      if (!req.file?.path) {
        res.status(400).json({
          ok: false,
          error: "Missing audio file.",
        });
        return;
      }

      const analysis = await transcribeAndAnalyzeAudio(req.file.path);

      const checkin = await recordCheckin({
        focusBlockId,
        result: analysis.suggestedResult,
        needleMover: analysis.suggestedNeedleMover,
        noteText: `[Voice] ${analysis.transcript}\n\nMood: ${analysis.mood}\nContext: ${analysis.context}`,
      });

      fs.unlink(req.file.path, () => {});

      res.json({
        ok: true,
        analysis,
        checkin,
      });
    } catch (error) {
      next(error);
    }
  }
);

async function getHealthStatus() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      ok: true,
      service: "focus20-api",
      database: "connected",
      time: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      service: "focus20-api",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Database check failed",
      time: new Date().toISOString(),
    };
  }
}

app.get("/api/admin/analytics", async (_req, res, next) => {
  try {
    res.json(await getAdminAnalytics());
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/analytics", async (req, res, next) => {
  try {
    const secret = req.headers["x-admin-secret"];

    if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET) {
      res.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }

    res.json(await getAdminAnalytics());
  } catch (error) {
    next(error);
  }
});

app.get("/health", async (_req, res) => {
  const health = await getHealthStatus();
  res.status(health.ok ? 200 : 503).json(health);
});

app.get("/api/health", async (_req, res) => {
  const health = await getHealthStatus();
  res.status(health.ok ? 200 : 503).json(health);
});

app.get("/api/rules", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    await ensureUser(userId);

    res.json(await getRules(userId));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/rules", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    await ensureUser(userId);

    res.json(await updateRules(userId, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.get("/api/wake-plan", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    await ensureUser(userId);

    res.json(await refreshWakePlan(userId, false));
  } catch (error) {
    next(error);
  }
});

app.post("/api/wake-plan/refresh", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    await ensureUser(userId);

    res.json(await refreshWakePlan(userId, Boolean(req.body?.forceReserve)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/actions/:actionId/undo", async (req, res, next) => {
  try {
    res.json(await undoAction(req.params.actionId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/checkin", async (req, res, next) => {
  try {
    const feedback = await recordCheckin({
      focusBlockId: req.body?.focusBlockId,
      result: req.body?.result ?? "meh",
      needleMover: req.body?.needleMover ?? "unconfirmed",
      noteText: req.body?.noteText ?? req.body?.note ?? undefined,
    });

    res.json({ ok: true, feedback });
  } catch (error) {
    next(error);
  }
});

app.post("/api/voice-checkin", async (req, res, next) => {
  try {
    const feedback = await recordCheckin({
      focusBlockId: req.body?.focusBlockId,
      result: req.body?.result ?? "meh",
      needleMover: req.body?.needleMover ?? "unconfirmed",
      noteText: req.body?.noteText ?? req.body?.note ?? undefined,
    });

    res.json({ ok: true, feedback });
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/events", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);

    const startIso =
      typeof req.query.startIso === "string"
        ? req.query.startIso
        : new Date().toISOString();

    const endDate = new Date(startIso);
    endDate.setDate(endDate.getDate() + 7);

    const endIso =
      typeof req.query.endIso === "string"
        ? req.query.endIso
        : endDate.toISOString();

    res.json(await listCalendarEvents(userId, startIso, endIso));
  } catch (error) {
    next(error);
  }
});

app.post("/api/analytics/track", async (req, res, next) => {
  try {
    const event = await trackEvent(
      req.body?.name ?? req.body?.eventName ?? "unknown_event",
      req.body?.payload ?? {}
    );

    res.json({ ok: true, event });
  } catch (error) {
    next(error);
  }
});

app.get("/api/google/auth-url", (req, res, next) => {
  try {
    const userId = getRequestUserId(req);

    res.json({
      url: getGoogleAuthUrl(userId),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/google", (req, res, next) => {
  try {
    const userId = getRequestUserId(req);

    res.redirect(getGoogleAuthUrl(userId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/google/callback", async (req, res, next) => {
  try {
    const code = String(req.query.code ?? "");
    const userId = String(req.query.state ?? "");

    if (!code) {
      res.status(400).send("Missing Google OAuth code.");
      return;
    }

    if (!userId) {
      res.status(400).send("Missing Google OAuth state.");
      return;
    }

    await handleGoogleCallback(code, userId);

    res.redirect(`${CLIENT_URL}?calendar=connected`);
  } catch (error) {
    next(error);
  }
});

app.get("/api/insights/weekly", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);

    res.json(await getWeeklyInsights(userId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/notifications/can-send", async (_req, res, next) => {
  try {
    res.json(await canSendNotification());
  } catch (error) {
    next(error);
  }
});

app.post("/api/notifications/log-sent", async (req, res, next) => {
  try {
    res.json(
      await logNotificationSent({
        focusBlockId: req.body?.focusBlockId,
        type: req.body?.type ?? "pre_block_reminder",
      })
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/focus/start", async (req, res, next) => {
  try {
    res.json(await startFocusBlock(req.body?.focusBlockId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);

    res.json(
      await createTask(userId, req.body ?? {})
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);

    res.json(await listTasks(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks/:taskId/schedule", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);

res.json(
  await scheduleTask(
    userId,
    req.params.taskId,
    req.body ?? {}
  )
);
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks/:taskId/undo", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);

res.json(
  await undoTaskSchedule(userId, req.params.taskId)
);
  } catch (error) {
    next(error);
  }
});

app.post("/api/flex-shift/preview", async (req, res, next) => {
  try {
    res.json(
      await previewFlexShift({
        startIso: req.body?.startIso,
        endIso: req.body?.endIso,
      })
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/flex-shift/apply", async (req, res, next) => {
  try {
    res.json(
      await applyFlexShift({
        eventId: req.body?.eventId,
        title: req.body?.title,
        oldStartIso: req.body?.oldStartIso,
        oldEndIso: req.body?.oldEndIso,
        newStartIso: req.body?.newStartIso,
        newEndIso: req.body?.newEndIso,
        reason: req.body?.reason,
      })
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/cron/retry-calendar-writes", async (req, res, next) => {
  try {
    const limit = Number(req.body?.limit ?? 10);
    res.json(await retryCalendarWrites(limit));
  } catch (error) {
    next(error);
  }
});

app.get("/api/cron/retry-calendar-writes", async (_req, res, next) => {
  try {
    res.json(await retryCalendarWrites(10));
  } catch (error) {
    next(error);
  }
});

app.post("/api/google/disconnect", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await disconnectGoogleCalendar(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/reset-pattern-profile", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
res.json(await resetPatternProfile(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/clear-history", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
res.json(await clearUserHistory(userId));
  } catch (error) {
    next(error);
  }
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(error);

    const statusCode =
      typeof (error as any)?.statusCode === "number"
        ? (error as any).statusCode
        : 500;

    res.status(statusCode).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
);

ensureDemoUser()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Focus20 API running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start Focus20 API:", error);
    process.exit(1);
  });

  app.post("/api/push/subscribe", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await savePushSubscription(userId, req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/push/unsubscribe", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(
      await deletePushSubscription(userId, String(req.body?.endpoint ?? ""))
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/push/test", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);

    res.json(
      await sendPushToUser(userId, {
        title: "Focus20 notifications are ready",
        body: "You’ll get reminders when your protected block is coming up.",
        url: "/",
        tag: "focus20-test",
      })
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/notifications/end-of-day", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await scheduleEndOfDayCheckin(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/cron/notifications", async (req, res, next) => {
  try {
    const secret = req.headers["x-cron-secret"];

    if (
      process.env.CRON_SECRET &&
      secret !== process.env.CRON_SECRET
    ) {
      res.status(401).json({ ok: false, error: "Unauthorized cron." });
      return;
    }

    res.json(await processNotificationQueue());
  } catch (error) {
    next(error);
  }
});

app.get("/api/recovery/suggestion", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await getRecoverySuggestion(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/recovery/reschedule", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await autoRescheduleMissedWork(userId));
  } catch (error) {
    next(error);
  }
});