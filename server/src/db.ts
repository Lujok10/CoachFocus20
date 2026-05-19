import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export const DEMO_USER_ID = "demo-user";

/**
 * Optional fallback demo user for local development only.
 */
export async function ensureDemoUser() {
  return prisma.user.upsert({
    where: {
      id: DEMO_USER_ID,
    },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: "demo@focus20.local",
      timezone: "America/New_York",
      provider: "local",
      calendarConnected: false,
      calendarPermission: "none",
      protectEnabled: true,
      flexShiftEnabled: false,
      notificationsEnabled: true,
      completedFirstLever: false,
      maxMovesPerDay: 1,
      buffersMinutes: 10,
    },
  });
}

/**
 * Ensures a real Clerk-authenticated user exists.
 */
export async function ensureUser(userId: string) {
  if (!userId?.trim()) {
    throw new Error("Missing authenticated userId.");
  }

  const existing = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@focus20.local`,
      provider: "local",
      timezone: "America/New_York",

      calendarConnected: false,
      calendarPermission: "none",

      protectEnabled: true,
      flexShiftEnabled: false,
      notificationsEnabled: true,
      completedFirstLever: false,

      maxMovesPerDay: 1,
      buffersMinutes: 10,
    },
  });
}