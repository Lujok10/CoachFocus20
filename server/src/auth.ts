import type { Request } from "express";

type ClerkRequest = Request & {
  auth?: () => {
    userId?: string | null;
    sessionId?: string | null;
    actor?: unknown;
  };
};

export function getRequestUserId(req: Request) {
  const auth = (req as ClerkRequest).auth?.();

  if (auth?.userId) {
    return auth.userId;
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-user";
  }

  const error = new Error("Unauthorized");
  (error as Error & { statusCode?: number }).statusCode = 401;
  throw error;
}