import "dotenv/config";

import cors from "cors";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import multer from "multer";
import fs from "fs";
import os from "os";
import { prisma, ensureDemoUser, ensureUser } from "./db";
import { validateEnv } from "./env";
import { getRequestUserId } from "./auth";
import { requireAdmin, rateLimit } from "./security";
import {
  booleanField,
  enumField,
  isoDateField,
  optional,
  stringField,
  validateBody,
  validateQuery,
} from "./validation";
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
  undoAction,
  updateRules,
} from "./coach";

import { getGoogleAuthUrl, handleGoogleCallback } from "./google";
import { processCalendarWriteQueue } from "./calendarWriteQueue";
import { getWeeklyInsights } from "./insights";
import { retryCalendarWrites } from "./retryQueue";
import { getAdminAnalytics } from "./adminAnalytics";
import { trackAnalytics } from "./analytics";
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
const PORT = Number(process.env.PORT || env.apiPort || 8787);
const CLIENT_URL = env.clientUrl;

const app = express();

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

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
      callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-cron-secret"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.options("/{*splat}", cors());

app.use(clerkMiddleware());

app.use(
  "/api",
  rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "api" })
);

const strictWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "write",
});

const voiceLimiter = rateLimit({
  windowMs: 60_000,
  max: 6,
  keyPrefix: "voice",
});

const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("audio/")) {
      callback(new Error("Only audio files are allowed."));
      return;
    }
    callback(null, true);
  },
});

async function getHealthStatus() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      ok: true,
      service: "focus20-api",
      database: "connected",
      time: new Date().toISOString(),
    };
  } catch {
    return {
      ok: false,
      service: "focus20-api",
      database: "disconnected",
      time: new Date().toISOString(),
    };
  }
}

function requireCron(req: express.Request, res: express.Response) {
  const secret = req.headers["x-cron-secret"];

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    res.status(401).json({ ok: false, error: "Unauthorized cron." });
    return false;
  }

  return true;
}

const checkinSchema = {
  focusBlockId: stringField(120),
  result: optional(enumField(["crushed", "meh", "missed"])),
  needleMover: optional(enumField(["yes", "somewhat", "no", "unconfirmed"])),
  noteText: optional(stringField(5_000)),
  note: optional(stringField(5_000)),
};


app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "focus20-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", async (_req, res) => {
  const health = await getHealthStatus();
  res.status(health.ok ? 200 : 503).json(health);
});

app.get("/api/health", async (_req, res) => {
  const health = await getHealthStatus();
  res.status(health.ok ? 200 : 503).json(health);
});

app.get("/api/admin/analytics", requireAdmin, async (_req, res, next) => {
  try {
    res.json(await getAdminAnalytics());
  } catch (error) {
    next(error);
  }
});

app.post("/api/cron/calendar-write-queue", async (req, res, next) => {
  try {
    if (!requireCron(req, res)) return;
    res.json(await processCalendarWriteQueue());
  } catch (error) {
    next(error);
  }
});

app.get("/api/google/status", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);

    const connection = await prisma.googleCalendarConnection.findUnique({
      where: { userId },
    });

    const requiredScopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.freebusy",
    ];

    const currentScopes = String(connection?.scope ?? "");
    const missingScopes = requiredScopes.filter(
      (scope) => !currentScopes.includes(scope)
    );

    res.json({
      connected: Boolean(connection?.refreshToken),
      hasRefreshToken: Boolean(connection?.refreshToken),
      permission:
        missingScopes.length === 0 && connection?.refreshToken
          ? "write"
          : connection?.refreshToken
            ? "limited"
            : "none",
      missingScopes,
      reconnectRequired: !connection?.refreshToken || missingScopes.length > 0,
      authUrl: getGoogleAuthUrl(userId),
      updatedAt: connection?.updatedAt ?? null,
    });
  } catch (error) {
    next(error);
  }
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

app.patch(
  "/api/rules",
  strictWriteLimiter,
  validateBody({
    protectEnabled: optional(booleanField()),
    flexShiftEnabled: optional(booleanField()),
    notificationsEnabled: optional(booleanField()),
  }),
  async (req, res, next) => {
    try {
      const userId = getRequestUserId(req);
      await ensureUser(userId);
      res.json(await updateRules(userId, req.body ?? {}));
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/wake-plan", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    await ensureUser(userId);
    res.json(await refreshWakePlan(userId, false));
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/wake-plan/refresh",
  strictWriteLimiter,
  validateBody({ forceReserve: optional(booleanField()) }),
  async (req, res, next) => {
    try {
      const userId = getRequestUserId(req);
      await ensureUser(userId);
      res.json(await refreshWakePlan(userId, Boolean(req.body?.forceReserve)));
    } catch (error) {
      next(error);
    }
  }
);

app.post("/api/actions/:actionId/undo", strictWriteLimiter, async (req, res, next) => {
  try {
    res.json(await undoAction(String(req.params.actionId)));
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/checkin",
  strictWriteLimiter,
  validateBody(checkinSchema),
  async (req, res, next) => {
    try {
      const feedback = await recordCheckin({
      focusBlockId: req.body.focusBlockId,
      result: req.body?.result ?? "meh",
      needleMover: req.body?.needleMover ?? "unconfirmed",
      noteText: req.body?.noteText ?? req.body?.note ?? undefined,
    });
      res.json({ ok: true, feedback });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/voice-checkin",
  strictWriteLimiter,
  validateBody(checkinSchema),
  async (req, res, next) => {
    try {
      const feedback = await recordCheckin({
          focusBlockId: req.body.focusBlockId,
          result: req.body?.result ?? "meh",
          needleMover: req.body?.needleMover ?? "unconfirmed",
          noteText: req.body?.noteText ?? req.body?.note ?? undefined,
        });
      res.json({ ok: true, feedback });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/voice/checkin",
  voiceLimiter,
  upload.single("audio"),
  async (req, res, next) => {
    try {
      const focusBlockId = String(req.body?.focusBlockId ?? "");

      if (!focusBlockId || focusBlockId.length > 120) {
        res.status(400).json({ ok: false, error: "Missing or invalid focusBlockId." });
        return;
      }

      if (!req.file?.path) {
        res.status(400).json({ ok: false, error: "Missing audio file." });
        return;
      }

      const analysis = await transcribeAndAnalyzeAudio(
        req.file.path,
        req.file.mimetype,
        req.file.originalname || "focus20-checkin.webm"
      );
      console.log("VOICE FILE:", {
        path: req.file.path,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        filename: req.file.filename,
      });

      const checkin = await recordCheckin({
        focusBlockId,
        result: analysis.suggestedResult,
        needleMover: analysis.suggestedNeedleMover,
        noteText: `[Voice] ${analysis.transcript}\n\nMood: ${analysis.mood}\nContext: ${analysis.context}`,
      });

      fs.unlink(req.file.path, () => {});
      res.json({ ok: true, analysis, checkin });
        } catch (error) {
      console.error("VOICE CHECKIN ERROR:", error);

      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }

      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Voice upload failed.",
      });
    }
  }
);

app.get(
  "/api/calendar/events",
  validateQuery({
    startIso: optional(isoDateField()),
    endIso: optional(isoDateField()),
  }),
  async (req, res, next) => {
    const userId = getRequestUserId(req);
    const startIso =
      typeof req.query.startIso === "string" ? req.query.startIso : new Date().toISOString();
    const endDate = new Date(startIso);
    endDate.setDate(endDate.getDate() + 7);
    const endIso =
      typeof req.query.endIso === "string" ? req.query.endIso : endDate.toISOString();

    try {
      res.json(await listCalendarEvents(userId, startIso, endIso));
    } catch {
      const localTasks = await prisma.task.findMany({
        where: {
          userId,
          startIso: { gte: new Date(startIso) },
          endIso: { lte: new Date(endIso) },
        },
      });

      const localBlocks = await prisma.focusBlock.findMany({
        where: {
          userId,
          startIso: { gte: new Date(startIso) },
          endIso: { lte: new Date(endIso) },
        },
      });

      res.json([
        ...localTasks.map((task) => ({
          id: task.id,
          title: task.title,
          start: task.startIso,
          end: task.endIso,
          type: task.protectAsFocus ? "focus" : "task",
          protectAsFocus: task.protectAsFocus,
        })),
        ...localBlocks.map((block) => ({
          id: block.id,
          title: block.title,
          start: block.startIso,
          end: block.endIso,
          type: "focus",
          isFocusBlock: true,
        })),
      ]);
    }
  }
);

app.post(
  "/api/analytics/track",
  strictWriteLimiter,
  validateBody({
    name: optional(stringField(120)),
    eventName: optional(stringField(120)),
  }),
  async (req, res, next) => {
    try {
      const userId = getRequestUserId(req);

      await ensureUser(userId);

      const event = await trackAnalytics(
        userId,
        req.body?.name ?? req.body?.eventName ?? "unknown_event",
        req.body?.payload ?? {}
      );

      res.json({
        ok: true,
        event,
      });
    } catch (error) {
      console.error("Analytics tracking failed:", error);
      next(error);
    }
  }
);

app.get("/api/google/auth-url", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json({ url: getGoogleAuthUrl(userId) });
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

app.get("/api/google/callback", async (req, res) => {
  try {
    const code =
      typeof req.query.code === "string"
        ? req.query.code
        : "";

    const state =
      typeof req.query.state === "string"
        ? req.query.state
        : "";

    if (!code) {
      res
        .status(400)
        .send(
          "Missing Google OAuth code. Start connection from Focus20 Settings again."
        );
      return;
    }

    if (!state) {
      res
        .status(400)
        .send(
          "Missing Google OAuth state. Start connection from Focus20 Settings again."
        );
      return;
    }

    await handleGoogleCallback(code, state);

    const frontendUrl =
      process.env.FRONTEND_URL ?? "http://localhost:5173";

    res.redirect(
      `${frontendUrl}/settings?google=connected`
    );
  } catch (error) {
    console.error(
      "Google OAuth callback failed:",
      error
    );

    const frontendUrl =
      process.env.FRONTEND_URL ?? "http://localhost:5173";

    const message =
      error instanceof Error
        ? encodeURIComponent(error.message)
        : "unknown_error";

    res.redirect(
      `${frontendUrl}/settings?google=error&reason=${message}`
    );
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

app.get("/api/notifications/can-send", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);

    res.json(
      await canSendNotification(userId)
    );
  } catch (error) {
    next(error);
  }
});
app.post(
  "/api/notifications/log-sent",
  strictWriteLimiter,
  validateBody({
    focusBlockId: optional(stringField(120)),
    type: optional(enumField(["pre_block_reminder", "end_of_day_checkin"])),
  }),
  async (req, res, next) => {
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
  }
);

app.post(
  "/api/focus/start",
  strictWriteLimiter,
  validateBody({ focusBlockId: optional(stringField(120)) }),
  async (req, res, next) => {
    try {
      res.json(await startFocusBlock(req.body?.focusBlockId));
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/tasks",
  strictWriteLimiter,
  validateBody({
    title: stringField(200),
    category: optional(stringField(50)),
    startIso: optional(isoDateField()),
    endIso: optional(isoDateField()),
    protectAsFocus: optional(booleanField()),
  }),
  async (req, res, next) => {
    try {
      const userId = getRequestUserId(req);
      res.json(await createTask(userId, req.body ?? {}));
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/tasks", async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await listTasks(userId));
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/tasks/:taskId/schedule",
  strictWriteLimiter,
  validateBody({
    startIso: isoDateField(),
    endIso: isoDateField(),
    addToCalendar: optional(booleanField()),
    protectAsFocus: optional(booleanField()),
  }),
  async (req, res, next) => {
    try {
      const userId = getRequestUserId(req);
      res.json(await scheduleTask(userId, String(req.params.taskId), req.body ?? {}));
    } catch (error) {
      next(error);
    }
  }
);

app.post("/api/tasks/:taskId/undo", strictWriteLimiter, async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await undoTaskSchedule(userId, String(req.params.taskId)));
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/flex-shift/preview",
  strictWriteLimiter,
  validateBody({ startIso: isoDateField(), endIso: isoDateField() }),
  async (req, res, next) => {
    try {
      res.json(await previewFlexShift({ startIso: req.body.startIso, endIso: req.body.endIso }));
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/flex-shift/apply",
  strictWriteLimiter,
  validateBody({
    eventId: stringField(200),
    title: stringField(200),
    oldStartIso: isoDateField(),
    oldEndIso: isoDateField(),
    newStartIso: isoDateField(),
    newEndIso: isoDateField(),
    reason: optional(stringField(1_000)),
  }),
  async (req, res, next) => {
    try {
      res.json(
        await applyFlexShift({
          eventId: req.body.eventId,
          title: req.body.title,
          oldStartIso: req.body.oldStartIso,
          oldEndIso: req.body.oldEndIso,
          newStartIso: req.body.newStartIso,
          newEndIso: req.body.newEndIso,
          reason: req.body.reason,
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

app.post("/api/cron/retry-calendar-writes", async (req, res, next) => {
  try {
    if (!requireCron(req, res)) return;
    const limit = Number(req.body?.limit ?? 10);
    res.json(await retryCalendarWrites(Number.isFinite(limit) ? limit : 10));
  } catch (error) {
    next(error);
  }
});

app.get("/api/cron/retry-calendar-writes", async (req, res, next) => {
  try {
    if (!requireCron(req, res)) return;
    res.json(await retryCalendarWrites(10));
  } catch (error) {
    next(error);
  }
});

app.post("/api/google/disconnect", strictWriteLimiter, async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await disconnectGoogleCalendar(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/reset-pattern-profile", strictWriteLimiter, async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await resetPatternProfile(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/clear-history", strictWriteLimiter, async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await clearUserHistory(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/push/subscribe", strictWriteLimiter, async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await savePushSubscription(userId, req.body));
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/push/unsubscribe",
  strictWriteLimiter,
  validateBody({ endpoint: stringField(2_000) }),
  async (req, res, next) => {
    try {
      const userId = getRequestUserId(req);
      res.json(await deletePushSubscription(userId, String(req.body?.endpoint ?? "")));
    } catch (error) {
      next(error);
    }
  }
);

app.post("/api/push/test", strictWriteLimiter, async (req, res, next) => {
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

app.post("/api/notifications/end-of-day", strictWriteLimiter, async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await scheduleEndOfDayCheckin(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/cron/notifications", async (req, res, next) => {
  try {
    if (!requireCron(req, res)) return;
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

app.post("/api/recovery/reschedule", strictWriteLimiter, async (req, res, next) => {
  try {
    const userId = getRequestUserId(req);
    res.json(await autoRescheduleMissedWork(userId));
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
    const statusCode =
      typeof (error as { statusCode?: unknown })?.statusCode === "number"
        ? ((error as { statusCode: number }).statusCode)
        : 500;

    const safeMessage =
      statusCode >= 500
        ? "Something went wrong. Please try again."
        : error instanceof Error
          ? error.message
          : "Request failed.";

    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }

    res.status(statusCode).json({ ok: false, error: safeMessage });
  }
);

ensureDemoUser()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Focus20 API running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start Focus20 API.");
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
    process.exit(1);
  });
