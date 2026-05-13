import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export const DEMO_USER_ID = "demo-user";

export async function ensureDemoUser() {
  return prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      timezone: "America/New_York",
      provider: "local",
      calendarConnected: false,
      calendarPermission: "none",
    },
  });
}
export async function ensureUser(userId: string) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@focus20.local`,
      provider: "google",
      timezone: "America/New_York",
      calendarConnected: false,
      calendarPermission: "read_only",
      protectEnabled: true,
      flexShiftEnabled: false,
      notificationsEnabled: true,
      completedFirstLever: false,
      maxMovesPerDay: 1,
      buffersMinutes: 10,
    },
  });
}
