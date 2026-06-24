import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
};



const buckets = new Map<string, { count: number; resetAt: number }>();


function getIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuth(req);
    const id = auth.userId ? `user:${auth.userId}` : `ip:${getIp(req)}`;
    const key = `${options.keyPrefix ?? req.path}:${id}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (bucket.count >= options.max) {
      return res.status(429).json({
        ok: false,
        error: "Too many requests. Please wait a moment and try again.",
      });
    }

    bucket.count += 1;
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {

  console.log("CLERK CONFIG", {
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY?.slice(0, 20),
  secretKey: process.env.CLERK_SECRET_KEY?.slice(0, 20),
});
  
  const auth = getAuth(req) as any;

  if (!auth.userId) {
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }

  const claims = auth.sessionClaims ?? {};
  const metadata = claims.metadata ?? claims.publicMetadata ?? {};
  const role =
    metadata.role ??
    metadata.appRole ??
    claims.role ??
    claims.org_role ??
    claims.organization_role;

  if (role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admin access required." });
  }

  next();
}