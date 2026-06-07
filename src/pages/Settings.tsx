import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Calendar,
  Database,
  ExternalLink,
  PlugZap,
  Shield,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";

import {
  apiClearUserHistory,
  apiDisconnectGoogle,
  apiGetUserRules,
  apiResetPatternProfile,
  apiSaveUserRules,
  getGoogleConnectUrl,
} from "../services/apiClient";

import {
  registerPushNotifications,
  sendTestPushNotification,
  unregisterPushNotifications,
} from "../services/pushNotifications";

import { usePwaInstall } from "../hooks/usePwaInstall";

type Rules = {
  provider: "local" | "google" | "microsoft";
  calendarConnected: boolean;
  calendarPermission: "write" | "read-only" | "none";
  protectEnabled: boolean;
  flexShiftEnabled: boolean;
  notificationsEnabled: boolean;
  completedFirstLever: boolean;
  maxMovesPerDay: number;
  buffersMinutes: number;
  timezone: string;
};

const defaultRules: Rules = {
  provider: "local",
  calendarConnected: false,
  calendarPermission: "none",
  protectEnabled: true,
  flexShiftEnabled: false,
  notificationsEnabled: false,
  completedFirstLever: false,
  maxMovesPerDay: 1,
  buffersMinutes: 10,
  timezone: "America/New_York",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 className="mb-4 text-sm font-semibold text-slate-800">{title}</h2>
      <div className="space-y-4">{children}</div>
    </motion.section>
  );
}

function Row({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: any;
  label: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
          <Icon className="h-4 w-4 text-slate-600" />
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}

function Toggle({
  icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  description: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <Row icon={icon} label={label} description={description}>
      <button
        onClick={onChange}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          value ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </Row>
  );
}

export function Settings() {
  const [rules, setRules] = useState<Rules>(defaultRules);
  const [backendOnline, setBackendOnline] = useState(false);
  const [googleConnectUrl, setGoogleConnectUrl] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");

  const { canInstall, install } = usePwaInstall();

  const loadSettings = async () => {
    try {
      const remoteRules = await apiGetUserRules();
      setRules({ ...defaultRules, ...remoteRules });
      setBackendOnline(true);
    } catch (error) {
      console.error("Failed to load rules", error);
      setBackendOnline(false);
    }

    try {
      const url = await getGoogleConnectUrl();
      setGoogleConnectUrl(url);
    } catch {
      setGoogleConnectUrl("");
    }
  };

  useEffect(() => {
    loadSettings();

    const params = new URLSearchParams(window.location.search);

    if (params.get("calendar") === "connected") {
      window.history.replaceState({}, "", window.location.pathname);
      loadSettings();
    }
  }, []);
    const resetOnboarding = () => {
      localStorage.removeItem("focus20_onboarding_completed");
      window.location.reload();
    };

  const updateRules = async (patch: Partial<Rules>) => {
    const nextRules = {
      ...rules,
      ...patch,
    };

    setRules(nextRules);

    try {
      await apiSaveUserRules(nextRules);
      setBackendOnline(true);
    } catch (error) {
      console.error("Failed to save rules", error);
      setBackendOnline(false);
    }
  };

  const runAction = async (
    action: () => Promise<any>,
    successMessage: string
  ) => {
    setIsWorking(true);
    setMessage("");

    try {
      await action();
      setMessage(successMessage);
      await loadSettings();
    } catch (error) {
      console.error(error);
      setMessage("Action failed. Please try again.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="px-4 py-4">
          <h1 className="text-xl font-semibold text-slate-800">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Controls for calendar, AI actions, privacy, and notifications
          </p>
        </div>
      </header>

      <div className="space-y-6 px-4 py-4">
        {message && (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <Section title="Backend">
          <Row
            icon={PlugZap}
            label="API Status"
            description={
              backendOnline
                ? "Express + Prisma backend connected"
                : "Using local fallback until backend is running"
            }
          >
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                backendOnline
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {backendOnline ? "Online" : "Fallback"}
            </span>
          </Row>
        </Section>

        <Section title="Account">
          <Row
            icon={User}
            label="Profile"
            description="Signed-in Focus20 user"
          />

          <Row
            icon={Calendar}
            label="Google Calendar OAuth"
            description={
              rules.calendarConnected && rules.provider === "google"
                ? "Connected for calendar access"
                : "Connect to enable free/busy and event creation"
            }
          >
            <a
              href={googleConnectUrl || undefined}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600"
            >
              Connect <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Row>

          <Row
            icon={Calendar}
            label="Connected Calendars"
            description={
              rules.calendarConnected
                ? `${rules.provider} connected`
                : "Not connected"
            }
          >
            <select
              value={rules.provider}
              onChange={(e) =>
                updateRules({
                  provider: e.target.value as Rules["provider"],
                  calendarConnected: e.target.value !== "local",
                })
              }
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              <option value="local">Local</option>
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
            </select>
          </Row>

          <Row
            icon={PlugZap}
            label="Calendar Permission"
            description="Controls reserve versus suggestion behavior"
          >
            <select
              value={rules.calendarPermission}
              onChange={(e) =>
                updateRules({
                  calendarPermission:
                    e.target.value as Rules["calendarPermission"],
                })
              }
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              <option value="write">Write</option>
              <option value="read-only">Read-only</option>
              <option value="none">None</option>
            </select>
          </Row>
        </Section>

        <Section title="AI Safety Rules">
          <Toggle
            icon={Shield}
            label="Protect my 20% time"
            description="Allow silent reservation when calendar has write access"
            value={rules.protectEnabled}
            onChange={() =>
              updateRules({ protectEnabled: !rules.protectEnabled })
            }
          />

          <Toggle
            icon={Shield}
            label="Flex shift opt-in"
            description="Default off. Only FLEX events can move; max 1/day."
            value={rules.flexShiftEnabled}
            onChange={() =>
              updateRules({ flexShiftEnabled: !rules.flexShiftEnabled })
            }
          />

          <Toggle
            icon={Bell}
            label="Notifications"
            description={
              rules.completedFirstLever
                ? "Max 2/day: pre-block + optional check-in"
                : "Locked until first lever block is completed"
            }
            value={rules.notificationsEnabled}
            onChange={() =>
              updateRules({
                notificationsEnabled: rules.completedFirstLever
                  ? !rules.notificationsEnabled
                  : false,
              })
            }
          />
        </Section>

        <Section title="Push Notifications">
          <div className="space-y-3">
            <button
              disabled={isWorking}
              onClick={() =>
                runAction(
                  registerPushNotifications,
                  "Push notifications enabled."
                )
              }
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              Enable Push Notifications
            </button>

            <button
              disabled={isWorking}
              onClick={() =>
                runAction(
                  sendTestPushNotification,
                  "Test notification sent."
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Send Test Notification
            </button>

            <button
              disabled={isWorking}
              onClick={() =>
                runAction(
                  unregisterPushNotifications,
                  "Push notifications disabled."
                )
              }
              className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 disabled:opacity-50"
            >
              Disable Push Notifications
            </button>
          </div>
        </Section>

       <Section title="Mobile App">
            <Row
              icon={Smartphone}
              label="Install Focus20"
              description="Add Focus20 to your home screen as a PWA"
            >
              {canInstall ? (
                <button
                  onClick={install}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                >
                  Install
                </button>
              ) : (
                <span className="text-xs text-slate-400">
                  Available after visit
                </span>
              )}
            </Row>

            <div className="mt-4">
              <button
                onClick={resetOnboarding}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Replay Onboarding
              </button>
            </div>
          </Section>

        <Section title="Preferences">
          <Row
            icon={Bell}
            label="Buffer Minutes"
            description="Default spacing before and after protected blocks"
          >
            <input
              type="number"
              min={0}
              max={60}
              value={rules.buffersMinutes}
              onChange={(e) =>
                updateRules({ buffersMinutes: Number(e.target.value) })
              }
              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs"
            />
          </Row>

          <Row
            icon={Shield}
            label="Max Flex Moves Per Day"
            description="Hard cap for AI event shifting"
          >
            <input
              type="number"
              min={0}
              max={3}
              value={rules.maxMovesPerDay}
              onChange={(e) =>
                updateRules({ maxMovesPerDay: Number(e.target.value) })
              }
              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs"
            />
          </Row>
        </Section>

        <Section title="Privacy & Data">
          <div className="space-y-3">
            <button
              disabled={isWorking}
              onClick={() =>
                runAction(apiDisconnectGoogle, "Google Calendar disconnected.")
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Disconnect Google Calendar
            </button>

            <button
              disabled={isWorking}
              onClick={() =>
                runAction(
                  apiResetPatternProfile,
                  "Learned patterns were reset."
                )
              }
              className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 disabled:opacity-50"
            >
              Reset Learned Patterns
            </button>

            <button
              disabled={isWorking}
              onClick={() =>
                runAction(apiClearUserHistory, "User history cleared.")
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear User History
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}