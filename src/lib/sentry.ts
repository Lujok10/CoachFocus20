import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,

    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    tracesSampleRate: 0.1,
  });
}

export { Sentry };