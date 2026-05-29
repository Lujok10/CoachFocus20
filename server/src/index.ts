import "dotenv/config";

import cors from "cors";
import express from "express";
import { clerkMiddleware } from "@clerk/express";

import { prisma, ensureDemoUser, ensureUser } from "./db";
import { validateEnv } from "./env";
import { getRequestUserId } from "./auth";

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
  CLIENT_URL,
  process.env.CLIENT_URL,
  process.env.FRONTEND_ORIGIN,
  "https://coach-focus20.vercel.app",
  "https://coach-focus20-hisa908gf-noel-nyirenda-s-projects.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
].filter(Boolean) as string[];

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
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      console.error("Blocked by CORS:", origin);
      callback(new Error(`Blocked by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.use(
  clerkMiddleware({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    audience: "focus20-api",
  })
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