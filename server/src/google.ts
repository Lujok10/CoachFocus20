import { google } from "googleapis";
import { prisma, DEMO_USER_ID } from "./db";
import { encryptSecret, decryptSecret } from "./crypto";

const calendarScopes = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "openid",
  "email",
  "profile",
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

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl() {
  const oauth2Client = getOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: calendarScopes,
    state: DEMO_USER_ID,
  });
}

export async function handleGoogleCallback(code: string) {
  console.log("Google callback hit");

  const oauth2Client = getOAuthClient();

  const { tokens } = await oauth2Client.getToken(code);
  console.log("Received Google tokens", {
    hasAccessToken: Boolean(tokens.access_token),
    hasRefreshToken: Boolean(tokens.refresh_token),
    expiryDate: tokens.expiry_date,
  });

  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({
    version: "v2",
    auth: oauth2Client,
  });

  const profile = await oauth2.userinfo.get();
  console.log("Google profile:", profile.data.email);

  await prisma.user.upsert({
    where: {
      id: DEMO_USER_ID,
    },
    update: {
      email: profile.data.email ?? undefined,
      name: profile.data.name ?? undefined,
      provider: "google",
      calendarConnected: true,
      calendarPermission: "write",
    },
    create: {
      id: DEMO_USER_ID,
      email: profile.data.email ?? undefined,
      name: profile.data.name ?? undefined,
      provider: "google",
      calendarConnected: true,
      calendarPermission: "write",
    },
  });

  console.log("User saved as Google-connected");

  const existingConnection = await prisma.googleCalendarConnection.findUnique({
    where: {
      userId: DEMO_USER_ID,
    },
  });

  await prisma.googleCalendarConnection.upsert({
    where: {
      userId: DEMO_USER_ID,
    },
    update: {
      googleEmail: profile.data.email ?? undefined,
      accessToken:
        encryptedOrExisting(tokens.access_token, existingConnection?.accessToken) ??
        encryptedOrEmpty(""),
      refreshToken:
        encryptedOrExisting(
          tokens.refresh_token,
          existingConnection?.refreshToken
        ) ?? undefined,
      scope: tokens.scope ?? existingConnection?.scope ?? undefined,
      expiryDate: tokens.expiry_date
        ? BigInt(tokens.expiry_date)
        : existingConnection?.expiryDate ?? undefined,
    },
    create: {
      userId: DEMO_USER_ID,
      googleEmail: profile.data.email ?? undefined,
      accessToken: encryptedOrEmpty(tokens.access_token),
      refreshToken: tokens.refresh_token
        ? encryptedOrEmpty(tokens.refresh_token)
        : undefined,
      scope: tokens.scope,
      expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : undefined,
    },
  });

  console.log("Google connection saved");
}

export async function getCalendarClient() {
  const connection = await prisma.googleCalendarConnection.findUnique({
    where: {
      userId: DEMO_USER_ID,
    },
  });

  if (!connection) {
    return null;
  }

  const oauth2Client = getOAuthClient();

  oauth2Client.setCredentials({
    access_token: decryptSecret(connection.accessToken),
    refresh_token: decryptSecret(connection.refreshToken) ?? undefined,
    expiry_date: connection.expiryDate ? Number(connection.expiryDate) : undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    try {
      await prisma.googleCalendarConnection.update({
        where: {
          userId: DEMO_USER_ID,
        },
        data: {
          accessToken:
            encryptedOrExisting(tokens.access_token, connection.accessToken) ??
            connection.accessToken,
          refreshToken:
            encryptedOrExisting(tokens.refresh_token, connection.refreshToken) ??
            connection.refreshToken,
          expiryDate: tokens.expiry_date
            ? BigInt(tokens.expiry_date)
            : connection.expiryDate,
        },
      });
    } catch (error) {
      console.error("Failed to persist refreshed Google tokens", error);
    }
  });

  return google.calendar({
    version: "v3",
    auth: oauth2Client,
  });
}

export async function googleFreeBusy(startIso: string, endIso: string) {
  const calendar = await getCalendarClient();

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
  existingEventId?: string | null;
  title: string;
  startIso: string;
  endIso: string;
  focusBlockId: string;
  leverCategory: string;
}) {
  const calendar = await getCalendarClient();

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
  eventId: string;
  startIso: string;
  endIso: string;
  reason?: string;
}) {
  const calendar = await getCalendarClient();

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

export async function googleDeleteEvent(eventId: string) {
  const calendar = await getCalendarClient();

  if (!calendar) {
    throw new Error("Google Calendar is not connected.");
  }

  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });
}