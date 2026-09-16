import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { Readable } from "node:stream";
import { clerkFrontendApiProxy } from "@clerk/backend/proxy";

export default async function handler(
  req: ExpressRequest,
  res: ExpressResponse
) {
  try {
    const path =
      typeof req.query.path === "string" ? req.query.path : "";

    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query)) {
      if (key === "path") continue;

      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") {
            searchParams.append(key, item);
          }
        }
      } else if (typeof value === "string") {
        searchParams.append(key, value);
      }
    }

    const query = searchParams.toString();
    const proxyUrl =
      `https://coach-focus20.vercel.app/__clerk/${path}` +
      (query ? `?${query}` : "");

    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        headers.set(key, value.join(", "));
      } else if (value !== undefined) {
        headers.set(key, value);
      }
    }

    console.log("Clerk incoming request body diagnostic:", {
      method: req.method,
      contentType: req.headers["content-type"],
      contentLength: req.headers["content-length"],
      readableEnded: req.readableEnded,
      complete: req.complete,
      bodyType: typeof req.body,
      hasParsedBody: req.body !== undefined,
    });

    const hasBody =
      req.method !== "GET" &&
      req.method !== "HEAD" &&
      req.method !== "OPTIONS" &&
      req.method !== "DELETE";

    const request = new Request(proxyUrl, {
      method: req.method,
      headers,
      body: hasBody
        ? (Readable.toWeb(req) as ReadableStream)
        : undefined,
      duplex: hasBody ? "half" : undefined,
    } as RequestInit);

    const response = await clerkFrontendApiProxy(request, {
      proxyPath: "/__clerk",
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!response.ok) {
      const diagnosticResponse = response.clone();
      const diagnosticBody = await diagnosticResponse.text();

      console.error("Clerk proxy non-OK response:", {
        status: response.status,
        statusText: response.statusText,
        body: diagnosticBody.slice(0, 1000),
      });
    }

    res.status(response.status);

    res.setHeader(
      "Access-Control-Allow-Origin",
      "https://app.coach-focus20.vercel.app"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "set-cookie") {
        res.setHeader(key, value);
      }
    });

    const setCookies = response.headers.getSetCookie();

    if (setCookies.length > 0) {
      res.setHeader("Set-Cookie", setCookies);
    }

    if (!response.body) {
      res.end();
      return;
    }

    Readable.fromWeb(
      response.body as import("node:stream/web").ReadableStream
    ).pipe(res);
     } catch (error) {
    const err = error as Error & {
      cause?: {
        name?: string;
        message?: string;
        code?: string;
        errno?: string | number;
        syscall?: string;
        hostname?: string;
      };
    };

    console.error("Clerk proxy error:", {
      name: err?.name,
      message: err?.message,
      cause: err?.cause
        ? {
            name: err.cause.name,
            message: err.cause.message,
            code: err.cause.code,
            errno: err.cause.errno,
            syscall: err.cause.syscall,
            hostname: err.cause.hostname,
          }
        : undefined,
    });

    res.status(500).json({
      error: "Clerk proxy request failed",
    });
  }
}
