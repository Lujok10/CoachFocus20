import "dotenv/config";

import cors from "cors";
import express from "express";

import { prisma, ensureDemoUser } from "./db";
import { validateEnv } from "./env";

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

const env = validateEnv();

const PORT = env.apiPort;
const CLIENT_URL = env.clientUrl;

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://coach-focus20.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
].filter(Boolean) as string[];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }

  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      console.error("Blocked by CORS:", origin);

      callback(new Error(`Blocked by CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

app.use(express.json());

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

app.get("/health", async (_req, res) => {
  const health = await getHealthStatus();
  res.status(health.ok ? 200 : 503).json(health);
});

app.get("/api/health", async (_req, res) => {
  const health = await getHealthStatus();
  res.status(health.ok ? 200 : 503).json(health);
});

app.get("/api/rules", async (_req, res, next) => {
  try {
    res.json(await getRules());
  } catch (error) {
    next(error);
  }
});

app.patch("/api/rules", async (req, res, next) => {
  try {
    res.json(await updateRules(req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.get("/api/wake-plan", async (_req, res, next) => {
  try {
    res.json(await refreshWakePlan(false));
  } catch (error) {
    next(error);
  }
});

app.post("/api/wake-plan/refresh", async (req, res, next) => {
  try {
    res.json(await refreshWakePlan(Boolean(req.body?.forceReserve)));
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

    res.json(await listCalendarEvents(startIso, endIso));
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

app.get("/api/google/auth-url", (_req, res, next) => {
  try {
    res.json({ url: getGoogleAuthUrl() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/google", (_req, res, next) => {
  try {
    res.redirect(getGoogleAuthUrl());
  } catch (error) {
    next(error);
  }
});

app.get("/api/google/callback", async (req, res, next) => {
  try {
    const code = String(req.query.code ?? "");

    if (!code) {
      res.status(400).send("Missing Google OAuth code.");
      return;
    }

    await handleGoogleCallback(code);

    res.redirect(`${CLIENT_URL}?calendar=connected`);
  } catch (error) {
    next(error);
  }
});

app.get("/api/insights/weekly", async (_req, res, next) => {
  try {
    res.json(await getWeeklyInsights());
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
    res.json(await createTask(req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks", async (_req, res, next) => {
  try {
    res.json(await listTasks());
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks/:taskId/schedule", async (req, res, next) => {
  try {
    res.json(await scheduleTask(req.params.taskId, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks/:taskId/undo", async (req, res, next) => {
  try {
    res.json(await undoTaskSchedule(req.params.taskId));
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

app.post("/api/google/disconnect", async (_req, res, next) => {
  try {
    res.json(await disconnectGoogleCalendar());
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/reset-pattern-profile", async (_req, res, next) => {
  try {
    res.json(await resetPatternProfile());
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/clear-history", async (_req, res, next) => {
  try {
    res.json(await clearUserHistory());
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

    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
);



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

app.post("/api/google/disconnect", async (_req, res, next) => {
  try {
    res.json(await disconnectGoogleCalendar());
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/reset-pattern-profile", async (_req, res, next) => {
  try {
    res.json(await resetPatternProfile());
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/clear-history", async (_req, res, next) => {
  try {
    res.json(await clearUserHistory());
  } catch (error) {
    next(error);
  }
});

app.get("/api/insights/weekly", async (_req, res, next) => {
  try {
    res.json(await getWeeklyInsights());
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

/**
 * Task routes
 */
app.post("/api/tasks", async (req, res, next) => {
  try {
    res.json(await createTask(req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks", async (_req, res, next) => {
  try {
    res.json(await listTasks());
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks/:taskId/schedule", async (req, res, next) => {
  try {
    res.json(await scheduleTask(req.params.taskId, req.body ?? {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks/:taskId/undo", async (req, res, next) => {
  try {
    res.json(await undoTaskSchedule(req.params.taskId));
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

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(error);

    res.status(500).json({
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


