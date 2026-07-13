import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

export function initializeSentry() {
  if (!sentryDsn) {
    console.warn("Sentry is not configured.");
    return;
  }

  Sentry.init({
    dsn: sentryDsn,

    environment:
      import.meta.env.MODE === "production"
        ? "production"
        : "development",

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Capture 10% of normal performance transactions.
    tracesSampleRate: 0.1,

    // Do not continuously record normal user sessions.
    replaysSessionSampleRate: 0,

    // Capture a replay only when an error occurs.
    replaysOnErrorSampleRate: 1,

    beforeSend(event) {
      // Avoid sending authorization headers or sensitive request data.
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.authorization;
      }

      return event;
    },
  });
}

export { Sentry };