import * as Sentry from "@sentry/react";

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,

    integrations: [],

    tracesSampleRate: 1.0,

    environment: import.meta.env.MODE,
  });
}

export { Sentry };