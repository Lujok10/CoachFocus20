import express from "express";
import { clerkMiddleware } from "@clerk/express";

const app = express();

app.use((req, _res, next) => {
  const path = typeof req.query.path === "string" ? req.query.path : "";

  if (path) {
    req.url = `/__clerk/${path}`;
  }

  next();
});

app.use(
  clerkMiddleware({
    frontendApiProxy: {
      enabled: true,
      path: "/__clerk",
    },
  })
);

export default app;
