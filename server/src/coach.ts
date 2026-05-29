import { google } from "googleapis";
import { prisma, ensureUser } from "./db";
import { encryptSecret, decryptSecret } from "./crypto";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
];

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function encryptedOrEmpty(value: string | null | undefined) {
  return encryptSecret(value ?? "") ?? "";
}

function encryptedOrExisting(
  value: string | null | undefined,
  existing: string | null | undefined
) {
  if (!value) return existing ?? null;

  return encryptSecret(value) ?? existing ?? null;
}

export function getOAuthClient() {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = requiredEnv("GOOGLE_REDIRECT_URI");

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}



export async function handleGoogleCallback(
  code: string,
  userId: string
) {
  console.log("Google callback hit for user:", userId);

  await ensureUser(userId);

  const oauth2Client = getOAuthClient();

  const { tokens } = await oauth2Client.getToken(code);

  console.log("Received Google tokens", {
    hasAccessToken: Boolean(tokens.access_token),
    hasRefreshToken: Boolean(tokens.refresh_token),
    expiryDate: tokens.expiry_date,
    scope: tokens.scope,
  });

  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({
    version: "v2",
    auth: oauth2Client,
  });

  const profile = await oauth2.userinfo.get();

  console.log("Google profile:", profile.data.email);

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      email: profile.data.email ?? undefined,
      name: profile.data.name ?? undefined,
      provider: "google",
      calendarConnected: true,
      calendarPermission: "write",
    },
  });

  const existingConnection =
    await prisma.googleCalendarConnection.findUnique({
      where: {
        userId,
      },
    });

  await prisma.googleCalendarConnection.upsert({
    where: {
      userId,
    },
    update: {
      googleEmail: profile.data.email ?? undefined,
      accessToken:
        encryptedOrExisting(
          tokens.access_token,
          existingConnection?.accessToken
        ) ?? encryptedOrEmpty(""),
      refreshToken:
        encryptedOrExisting(
          tokens.refresh_token,
          existingConnection?.refreshToken
        ) ?? existingConnection?.refreshToken ?? undefined,
      scope:
        tokens.scope ??
        existingConnection?.scope ??
        GOOGLE_SCOPES.join(" "),
      expiryDate: tokens.expiry_date
        ? BigInt(tokens.expiry_date)
        : existingConnection?.expiryDate ?? undefined,
    },
    create: {
      userId,
      googleEmail: profile.data.email ?? undefined,
      accessToken: encryptedOrEmpty(tokens.access_token),
      refreshToken: tokens.refresh_token
        ? encryptedOrEmpty(tokens.refresh_token)
        : undefined,
      scope: tokens.scope ?? GOOGLE_SCOPES.join(" "),
      expiryDate: tokens.expiry_date
        ? BigInt(tokens.expiry_date)
        : undefined,
    },
  });

  console.log("Google connection saved for user:", userId);

  return {
    ok: true,
    email: profile.data.email,
  };
}

export async function getCalendarClient(userId: string) {
  const connection =
    await prisma.googleCalendarConnection.findUnique({
      where: {
        userId,
      },
    });

  if (!connection) {
    return null;
  }

  const oauth2Client = getOAuthClient();

  oauth2Client.setCredentials({
    access_token: decryptSecret(connection.accessToken),
    refresh_token:
      decryptSecret(connection.refreshToken) ?? undefined,
    expiry_date: connection.expiryDate
      ? Number(connection.expiryDate)
      : undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    try {
      await prisma.googleCalendarConnection.update({
        where: {
          userId,
        },
        data: {
          accessToken:
            encryptedOrExisting(
              tokens.access_token,
              connection.accessToken
            ) ?? connection.accessToken,
          refreshToken:
            encryptedOrExisting(
              tokens.refresh_token,
              connection.refreshToken
            ) ?? connection.refreshToken,
          expiryDate: tokens.expiry_date
            ? BigInt(tokens.expiry_date)
            : connection.expiryDate,
        },
      });
    } catch (error) {
      console.error(
        "Failed to persist refreshed Google tokens",
        error
      );
    }
  });

  return google.calendar({
    version: "v3",
    auth: oauth2Client,
  });
}

export async function googleFreeBusy(
  userId: string,
  startIso: string,
  endIso: string
) {
  const calendar = await getCalendarClient(userId);

  if (!calendar) {
    return [];
  }

  const result = await calendar.freebusy.query({
    requestBody: {
      timeMin: startIso,
      timeMax: endIso,
      items: [{ id: "primary" }],
    },
  });

  return result.data.calendars?.primary?.busy ?? [];
}

export async function googleCreateOrUpdateFocusEvent(params: {
  userId: string;
  existingEventId?: string | null;
  title: string;
  startIso: string;
  endIso: string;
  focusBlockId: string;
  leverCategory: string;
}) {
  const calendar = await getCalendarClient(params.userId);

  if (!calendar) {
    throw new Error("Google Calendar is not connected.");
  }

  const event = {
    summary: params.title,
    description: [
      "Created by Focus20 AI Deployment Coach.",
      `focus_block_id=${params.focusBlockId}`,
      `lever_category=${params.leverCategory}`,
      "Undo from Focus20 to remove this reservation.",
    ].join("\n"),
    start: {
      dateTime: params.startIso,
    },
    end: {
      dateTime: params.endIso,
    },
    transparency: "opaque",
  };

  if (params.existingEventId) {
    const updated = await calendar.events.patch({
      calendarId: "primary",
      eventId: params.existingEventId,
      requestBody: event,
    });

    return updated.data.id ?? params.existingEventId;
  }

  const created = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
  });

  if (!created.data.id) {
    throw new Error("Google Calendar did not return an event id.");
  }

  return created.data.id;
}

export async function googleMoveEvent(input: {
  userId: string;
  eventId: string;
  startIso: string;
  endIso: string;
  reason?: string;
}) {
  const calendar = await getCalendarClient(input.userId);

  if (!calendar) {
    throw new Error("Google Calendar is not connected.");
  }

  const current = await calendar.events.get({
    calendarId: "primary",
    eventId: input.eventId,
  });

  const existingDescription = current.data.description ?? "";

  const updated = await calendar.events.patch({
    calendarId: "primary",
    eventId: input.eventId,
    requestBody: {
      start: {
        dateTime: input.startIso,
      },
      end: {
        dateTime: input.endIso,
      },
      description: `${existingDescription}\n\nMoved by Focus20: ${
        input.reason ?? "Flex shift"
      }`,
    },
  });

  return updated.data.id ?? input.eventId;
}

export async function applyFlexShift(input: {
  eventId: string;
  title: string;
  oldStartIso: string;
  oldEndIso: string;
  newStartIso: string;
  newEndIso: string;
  reason?: string;
}) {
  return {
    ok: true,
    moved: true,
    ...input,
  };
}

export async function canSendNotification() {
  return {
    ok: true,
    allowed: true,
  };
}

export async function getRules(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  return {
    userId: user.id,
    provider: user.provider,
    calendarConnected: user.calendarConnected,
    calendarPermission:
      user.calendarPermission === "read_only"
        ? "read-only"
        : user.calendarPermission,
    protectEnabled: user.protectEnabled,
    flexShiftEnabled: user.flexShiftEnabled,
    maxMovesPerDay: user.maxMovesPerDay,
    notificationsEnabled: user.notificationsEnabled,
    completedFirstLever: user.completedFirstLever,
    timezone: user.timezone,
    buffersMinutes: user.buffersMinutes,
  };
}

export async function listCalendarEvents(
  userId: string,
  startIso: string,
  endIso: string
) {
  await ensureUser(userId);

  const start = new Date(startIso);
  const end = new Date(endIso);

  const [blocks, tasks] = await Promise.all([
    prisma.focusBlock.findMany({
      where: {
        userId,
        startIso: {
          gte: start,
          lte: end,
        },
        status: {
          not: "cancelled",
        },
      },
      orderBy: {
        startIso: "asc",
      },
    }),

    prisma.task.findMany({
      where: {
        userId,
        startIso: {
          gte: start,
          lte: end,
        },
        status: {
          not: "unscheduled",
        },
      },
      orderBy: {
        startIso: "asc",
      },
    }),
  ]);

  return [
    ...blocks.map((block) => ({
      id: block.id,
      title: block.title,
      start: block.startIso,
      end: block.endIso,
      type: "focus",
      providerEventId: block.providerEventId,
      isFocusBlock: true,
      busy: true,
    })),

    ...tasks
      .filter((task) => task.startIso && task.endIso)
      .map((task) => ({
        id: task.id,
        title: task.title,
        start: task.startIso,
        end: task.endIso,
        type: task.protectAsFocus ? "focus" : "task",
        providerEventId: task.providerEventId,
        isFocusBlock: Boolean(task.protectAsFocus),
        busy: true,
      })),
  ];
}

export async function logNotificationSent(input: {
  focusBlockId?: string;
  type: string;
}) {
  return {
    ok: true,
    logged: true,
    ...input,
  };
}

export async function previewFlexShift(input: {
  startIso: string;
  endIso: string;
}) {
  return {
    ok: true,
    candidates: [],
  };
}

export async function recordCheckin(input: any) {
  return {
    ok: true,
    ...input,
  };
}

export async function refreshWakePlan(userId: string, force = false) {
  await ensureUser(userId);

  const now = new Date();
  const start = new Date(now.getTime() + 15 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  let block = await prisma.focusBlock.findFirst({
    where: {
      userId,
      status: {
        not: "cancelled",
      },
      startIso: {
        gte: now,
      },
    },
    orderBy: {
      startIso: "asc",
    },
  });

  if (!block || force) {
    block = await prisma.focusBlock.create({
      data: {
        userId,
        title: "Deep Work Session",
        provider: "local",
        providerEventId: null,
        startIso: start,
        endIso: end,
        status: "scheduled",
        leverCategory: "admin",
        predictedImpact: 4,
        confidence: 80,
      },
    });
  }

  const action = await prisma.actionsLog.create({
    data: {
      userId,
      actionType: "reserve_block",
      payload: {
        blockId: block.id,
        title: block.title,
        startIso: block.startIso.toISOString(),
        endIso: block.endIso.toISOString(),
      },
      undoPayload: {
        focusBlockId: block.id,
        operation: "cancel_focus_block",
      },
    },
  });

return {
  id: `wake_${block.id}`,

  sentence: `${block.title} — ${block.startIso.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })} to ${block.endIso.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}.`,

  lever: {
    title: block.title,
    category: block.leverCategory,
    predictedImpact: block.predictedImpact,
  },

  why: "This is your next protected execution block.",

  plan: [
    "Open the task or workspace.",
    "Work for the protected focus block.",
    "Capture the next action before stopping.",
  ],

  alternatives: [
    {
      title: "Clear one priority admin task",
      time: "Later today",
      category: "admin",
    },
    {
      title: "Review learning backlog",
      time: "Tomorrow morning",
      category: "learning",
    },
  ],

  timeLeak: {
    title: "Unprotected calendar time",
    minutes: 30,
    fixAction: "Protect this block before distractions take over.",
  },

  confidenceLevel: "high",
  confidence: block.confidence,

  block: {
    id: block.id,
    userId: block.userId,
    title: block.title,
    startIso: block.startIso.toISOString(),
    endIso: block.endIso.toISOString(),
    provider: block.provider,
    providerEventId: block.providerEventId,
    window: block.startIso.getHours() < 12 ? "AM" : "PM",
    status: block.status,
    leverCategory: block.leverCategory,
    predictedImpact: block.predictedImpact,
    confidence: block.confidence,
    startTime: block.startIso.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    endTime: block.endIso.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    durationMinutes: Math.round(
      (block.endIso.getTime() - block.startIso.getTime()) / 60000
    ),
    date: block.startIso.toISOString().split("T")[0],
  },

  status: block.status,
  reserved: block.status === "scheduled",
  isReserved: block.status === "scheduled",
  reservationStatus: block.status === "scheduled" ? "reserved" : "suggested",
  calendarReconnectRequired: false,
  readOnlyCalendar: false,
  actionId: action.id,
  undoToken: action.id,
};
}

export async function startFocusBlock(
  focusBlockId?: string
) {
  return {
    ok: true,
    focusBlockId,
  };
}

export async function trackEvent(
  name: string,
  payload?: any
) {
  return {
    ok: true,
    name,
    payload,
  };
}

export async function undoAction(actionId: string) {
  return {
    success: true,
    actionId,
  };
}

export async function updateRules(
  userId: string,
  data: any
) {
  return {
    ok: true,
    userId,
    ...data,
  };
}

export async function googleDeleteEvent(
  userId: string,
  eventId: string
) {
  const calendar = await getCalendarClient(userId);

  if (!calendar) {
    throw new Error("Google Calendar is not connected.");
  }

  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });

  return { ok: true };
}
