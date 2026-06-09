import { google } from "googleapis";
import { prisma, ensureUser } from "./db";

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

function getRedirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:8787/api/google/callback"
  );
}

function normalizeExpiryDate(
  value: number | bigint | Date | null | undefined
) {
  if (value instanceof Date) {
    return value.getTime();
  }

  return value ?? null;
}

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

export function getGoogleAuthUrl(userId?: string) {
  const oauth2Client = getOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPES,
    state: userId,
  });
}

export async function getAuthorizedGoogleClient(userId: string) {
  const connection = await prisma.googleCalendarConnection.findUnique({
    where: { userId },
  });

  if (!connection?.refreshToken) {
    throw new Error("Google Calendar reconnect required.");
  }

  const client = getOAuthClient();

  client.setCredentials({
    access_token: connection.accessToken || undefined,
    refresh_token: connection.refreshToken,
    expiry_date:
      typeof connection.expiryDate === "bigint"
        ? Number(connection.expiryDate)
        : connection.expiryDate ?? undefined,
  });

  client.on("tokens", async (tokens) => {
    await prisma.googleCalendarConnection.update({
      where: { userId },
      data: {
        accessToken: tokens.access_token ?? connection.accessToken,
        refreshToken: tokens.refresh_token ?? connection.refreshToken,
        expiryDate: normalizeExpiryDate(
          tokens.expiry_date ?? connection.expiryDate ?? null
        ),
        scope: tokens.scope ?? connection.scope,
        updatedAt: new Date(),
      },
    });
  });

  return client;
}

export async function handleGoogleCallback(code: string, userId: string) {
  await ensureUser(userId);

  const oauth2Client = getOAuthClient();

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({
    version: "v2",
    auth: oauth2Client,
  });

  const profile = await oauth2.userinfo.get();

  const existing = await prisma.googleCalendarConnection.findUnique({
    where: { userId },
  });

  await prisma.googleCalendarConnection.upsert({
    where: { userId },
    update: {
      googleEmail: profile.data.email ?? existing?.googleEmail ?? null,
      accessToken: tokens.access_token ?? existing?.accessToken ?? "",
      refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? "",
      scope: tokens.scope ?? existing?.scope ?? GOOGLE_CALENDAR_SCOPES.join(" "),
      expiryDate: tokens.expiry_date ?? existing?.expiryDate ?? null,
      updatedAt: new Date(),
    },
    create: {
      userId,
      googleEmail: profile.data.email ?? null,
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token ?? "",
      scope: tokens.scope ?? GOOGLE_CALENDAR_SCOPES.join(" "),
      expiryDate: tokens.expiry_date ?? null,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      email: profile.data.email ?? undefined,
      provider: "google",
      calendarConnected: true,
      calendarPermission: "write",
    },
  });

  return {
    ok: true,
    email: profile.data.email,
  };
}

async function getAuthedCalendarClient(userId: string) {
  const auth = await getAuthorizedGoogleClient(userId);

  return google.calendar({
    version: "v3",
    auth,
  });
}

export async function googleFreeBusy(
  userId: string,
  startIso: string,
  endIso: string
) {
  const calendar = await getAuthedCalendarClient(userId);

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startIso,
      timeMax: endIso,
      items: [{ id: "primary" }],
    },
  });

  const busy = response.data.calendars?.primary?.busy ?? [];

  return busy.map((item) => ({
    start: item.start,
    end: item.end,
  }));
}

export async function googleCreateOrUpdateFocusEvent(input: {
  userId: string;
  existingEventId?: string | null;
  title: string;
  startIso: string;
  endIso: string;
  focusBlockId: string;
  leverCategory: string;
}) {
  const calendar = await getAuthedCalendarClient(input.userId);

  const eventBody = {
    summary: input.title,
    description:
      `Created by Focus20 AI Deployment Coach.\n` +
      `focus_block_id=${input.focusBlockId}\n` +
      `lever_category=${input.leverCategory}\n` +
      `Undo from Focus20 to remove this reservation.`,
    start: {
      dateTime: input.startIso,
    },
    end: {
      dateTime: input.endIso,
    },
    transparency: "opaque",
  };

  if (input.existingEventId) {
    const response = await calendar.events.update({
      calendarId: "primary",
      eventId: input.existingEventId,
      requestBody: eventBody,
    });

    return response.data.id ?? input.existingEventId;
  }

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: eventBody,
  });

  if (!response.data.id) {
    throw new Error("Google Calendar event was created without an event ID.");
  }

  return response.data.id;
}

export async function createGoogleCalendarEvent(
  userId: string,
  input: {
    summary: string;
    description?: string;
    startIso: string;
    endIso: string;
    transparency?: "opaque" | "transparent";
  }
) {
  const calendar = await getAuthedCalendarClient(userId);

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.startIso,
      },
      end: {
        dateTime: input.endIso,
      },
      transparency: input.transparency ?? "opaque",
    },
  });

  if (!response.data.id) {
    throw new Error("Google Calendar event was created without an event ID.");
  }

  return response.data.id;
}

export async function deleteGoogleCalendarEvent(
  userId: string,
  providerEventId: string
) {
  const calendar = await getAuthedCalendarClient(userId);

  await calendar.events.delete({
    calendarId: "primary",
    eventId: providerEventId,
  });

  return { ok: true };
}

export async function googleDeleteEvent(userId: string, eventId: string) {
  return deleteGoogleCalendarEvent(userId, eventId);
}

export async function googleMoveEvent(input: {
  userId: string;
  eventId: string;
  startIso: string;
  endIso: string;
  reason?: string;
}) {
  const calendar = await getAuthedCalendarClient(input.userId);

  const existing = await calendar.events.get({
    calendarId: "primary",
    eventId: input.eventId,
  });

  const response = await calendar.events.update({
    calendarId: "primary",
    eventId: input.eventId,
    requestBody: {
      ...existing.data,
      start: {
        dateTime: input.startIso,
      },
      end: {
        dateTime: input.endIso,
      },
      description: `${existing.data.description ?? ""}\n\nMoved by Focus20. ${
        input.reason ?? ""
      }`,
    },
  });

  return response.data.id ?? input.eventId;
}