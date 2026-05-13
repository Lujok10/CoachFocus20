import type { Request } from "express";
import { getAuth } from "@clerk/express";

export function getRequestUserId(req: Request) {
  const auth = getAuth(req);

  console.log("AUTH OBJECT:", auth);

  if (!auth.userId) {
    throw new Error("Unauthorized");
  }

  return auth.userId;
}