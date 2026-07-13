import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import "./lib/sentry";
import App from "./App";
import "./index.css";
import { reconcileAfterReconnect } from "./services/offlineSync";
import { UpdateAvailablePrompt } from "./components/UpdateAvailablePrompt";
import { initializeSentry } from "./services/sentry";import { Sentry } from "./services/sentry";

initializeSentry();
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function Root() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(newWorker);
              setShowUpdate(true);
            }
          });
        });
      })
      .catch(() => {
        // Do not block app startup if service worker registration fails.
      });

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
    };
  }, []);

  useEffect(() => {
    window.addEventListener("online", reconcileAfterReconnect);

    if (navigator.onLine) {
      reconcileAfterReconnect();
    }

    return () => {
      window.removeEventListener("online", reconcileAfterReconnect);
    };
  }, []);

  function updateApp() {
    if (!waitingWorker) return;

    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    setShowUpdate(false);
  }

  return (
    <React.StrictMode>
      <ClerkProvider publishableKey={clerkPubKey} afterSignOutUrl="/">
        <Sentry.ErrorBoundary
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
              <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <h1 className="text-xl font-black text-slate-900">
                  Focus20 encountered an error
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  The problem has been reported. Refresh the app and try again.
                </p>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Reload Focus20
                </button>
              </div>
            </div>
          }
        >
          <App />

          {showUpdate && (
            <UpdateAvailablePrompt
              onUpdate={updateApp}
              onDismiss={() => setShowUpdate(false)}
            />
          )}
        </Sentry.ErrorBoundary>
      </ClerkProvider>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);