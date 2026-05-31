import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function trackAnalytics(
  userId: string,
  name: string,
  payload: Prisma.InputJsonValue = {}
) {
  return prisma.analyticsEvent.create({
    data: {
      userId,
      name,
      payload,
    },
  });
}