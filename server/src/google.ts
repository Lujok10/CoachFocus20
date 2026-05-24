import { google } from "googleapis";
import { prisma, ensureUser } from "./db";

const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
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

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

export function getGoogleAuthUrl(userId: string) {
  const oauth2Client = getOAuthClient();

  console.log("GOOGLE_SCOPES USED:", GOOGLE_SCOPES);

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: false,
    scope: GOOGLE_SCOPES,
    state: userId,
  });
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

  await prisma.googleCalendarConnection.upsert({
    where: {
      userId,
    },
    update: {
      accessToken: tokens.access_token ?? undefined,
      refreshToken: tokens.refresh_token ?? undefined,
      scope: tokens.scope ?? GOOGLE_SCOPES.join(" "),
      expiryDate: tokens.expiry_date ?? undefined,
    },
    create: {
      userId,
      googleEmail: profile.data.email ?? null,
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token ?? "",
      scope: tokens.scope ?? GOOGLE_SCOPES.join(" "),
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      googleConnection: true,
    },
  });

  const connection = user?.googleConnection;

  if (!connection?.accessToken && !connection?.refreshToken) {
    throw new Error("Google Calendar is not connected.");
  }

  const oauth2Client = getOAuthClient();

  oauth2Client.setCredentials({
    access_token: connection.accessToken ?? undefined,
    refresh_token: connection.refreshToken ?? undefined,
    expiry_date:
      typeof connection.expiryDate === "bigint"
        ? Number(connection.expiryDate)
        : connection.expiryDate ?? undefined,
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
  existingEventId?: string;
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

export async function googleDeleteEvent(userId: string, eventId: string) {
  const calendar = await getAuthedCalendarClient(userId);

  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });

  return { ok: true };
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