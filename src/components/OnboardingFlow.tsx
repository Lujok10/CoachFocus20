import { useState } from "react";
import { Calendar, CheckCircle2, Mic, Shield, Shuffle, X } from "lucide-react";
import { registerPushNotifications } from "../services/pushNotifications";

type OnboardingFlowProps = {
  onComplete: () => void;
  onConnectGoogle?: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
};

const steps = [
  {
    title: "Welcome to Focus20",
    icon: CheckCircle2,
    body: "Focus20 helps you protect the small block of time that creates the biggest progress each day.",
  },
  {
    title: "Protect Mode",
    icon: Shield,
    body: "When enabled, Focus20 can reserve protected focus blocks on your calendar so your highest-leverage work does not get crowded out.",
  },
  {
    title: "FLEX Shifting",
    icon: Shuffle,
    body: "FLEX shifting is optional. Focus20 will only suggest moving events clearly marked as FLEX, and it will never move protected events like family, travel, medical, or school.",
  },
  {
    title: "Voice Check-ins",
    icon: Mic,
    body: "After a focus session, you can record a quick voice check-in. Focus20 uses it to learn your patterns, detect friction, and improve future plans.",
  },
  {
    title: "Calendar Permissions",
    icon: Calendar,
    body: "Connect Google Calendar for free/busy checks and event creation. Without calendar access, Focus20 still works locally, but it can only suggest blocks instead of reserving them.",
  },
];

export function OnboardingFlow({
  onComplete,
  onConnectGoogle,
  onOpenPrivacy,
  onOpenTerms,
}: OnboardingFlowProps) {

  const [index, setIndex] = useState(0);
  const [notificationStatus, setNotificationStatus] = useState("");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [agreementError, setAgreementError] = useState("");
  const step = steps[index];
  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  async function handleEnableNotifications() {
    setNotificationStatus("");

    try {
      await registerPushNotifications();
      setNotificationStatus("Notifications enabled.");
    } catch (error) {
      console.error(error);
      setNotificationStatus("Notifications skipped. You can enable them later.");
    }
  }

  function finish() {
      if (!acceptedPolicies) {
        setAgreementError(
          "Please accept the Privacy Policy and Terms of Service to continue."
        );
        return;
      }

      setAgreementError("");

      localStorage.setItem("focus20_onboarding_completed", "true");
      localStorage.setItem(
        "focus20_policy_acceptance",
        JSON.stringify({
          accepted: true,
          privacyVersion: "2026-07-12",
          termsVersion: "2026-07-12",
          acceptedAt: new Date().toISOString(),
        })
      );

      onComplete();
    }

  return (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4">
    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Step {index + 1} of {steps.length}
        </div>

        <button
          type="button"
          onClick={() => {
            if (acceptedPolicies) {
              finish();
              return;
            }

            setIndex(steps.length - 1);
            setAgreementError(
              "Please accept the Privacy Policy and Terms of Service to finish setup."
            );
          }}
          className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close onboarding"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
        <Icon className="h-7 w-7" />
      </div>

      <h2 className="text-2xl font-bold text-slate-950">
        {step.title}
      </h2>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {step.body}
      </p>

      {step.title === "Calendar Permissions" && (
        <div className="mt-5 space-y-4">
          <button
            type="button"
            onClick={onConnectGoogle}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Connect Google Calendar
          </button>

          <button
            type="button"
            onClick={handleEnableNotifications}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Enable Notifications
          </button>

          {notificationStatus && (
            <p className="text-xs text-slate-500">
              {notificationStatus}
            </p>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={acceptedPolicies}
                onChange={(event) => {
                  setAcceptedPolicies(event.target.checked);

                  if (event.target.checked) {
                    setAgreementError("");
                  }
                }}
                className="mt-1 h-4 w-4 rounded border-slate-300 accent-emerald-600"
              />

              <span className="text-sm leading-6 text-slate-600">
                I have read and agree to the{" "}
                <button
                  type="button"
                  onClick={onOpenPrivacy}
                  className="font-bold text-indigo-600 underline hover:text-indigo-700"
                >
                  Privacy Policy
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={onOpenTerms}
                  className="font-bold text-indigo-600 underline hover:text-indigo-700"
                >
                  Terms of Service
                </button>
                .
              </span>
            </label>

            {agreementError && (
              <p className="mt-3 text-xs font-semibold text-rose-600">
                {agreementError}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() =>
            setIndex((value) => Math.max(0, value - 1))
          }
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={finish}
            disabled={!acceptedPolicies}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Finish Setup
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              setIndex((value) =>
                Math.min(steps.length - 1, value + 1)
              )
            }
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Next
          </button>
        )}
      </div>
    </div>
  </div>
);
}