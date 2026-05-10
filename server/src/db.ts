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
