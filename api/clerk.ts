import express from "express";
import { clerkMiddleware } from "@clerk/express";

const app = express();

app.use(
  clerkMiddleware({
    frontendApiProxy: {
      enabled: true,
      path: "/__clerk",
    },
  })
);

export default app;
