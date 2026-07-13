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
  apiGoogleStatus,
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

import {
  unlockAudio,
  playTaskCompletedSound,
} from "../services/sounds";

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
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            {icon}
          </div>
        )}

        <h2 className="text-sm font-black text-slate-900">{title}</h2>
      </div>

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

type SettingsProps = {
  onOpenHelp: () => void;
};


export function Settings({ onOpenHelp }: SettingsProps) {
  const [rules, setRules] = useState<Rules>(defaultRules);
  const [backendOnline, setBackendOnline] = useState(false);
  const [googleConnectUrl, setGoogleConnectUrl] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [googleStatus, setGoogleStatus] = useState<any>(null);
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

    apiGoogleStatus()
  .then(setGoogleStatus)
  .catch(() => setGoogleStatus(null));
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
              <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-blue-50 p-6 shadow-sm"
          >
            ...
          </motion.section>
            {message}
          </div>
        )}

        <Section title="System Health" icon={<Database className="h-4 w-4" />}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
                      Backend
                    </p>

                    <p className="mt-2 text-lg font-black text-slate-900">
                      {backendOnline ? "Online" : "Fallback"}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      {backendOnline
                        ? "Express + Prisma connected"
                        : "Local fallback active"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-blue-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
                      Database
                    </p>

                    <p className="mt-2 text-lg font-black text-slate-900">
                      {backendOnline ? "Connected" : "Unknown"}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-blue-700">
                      Focus history and rules storage
                    </p>
                  </div>

                  <div className="rounded-2xl bg-violet-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-600">
                      Calendar Sync
                    </p>

                    <p className="mt-2 text-lg font-black text-slate-900">
                      {rules.calendarConnected ? "Healthy" : "Not connected"}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-violet-700">
                      {rules.calendarPermission === "write"
                        ? "Read & write access"
                        : rules.calendarPermission === "read-only"
                          ? "Read-only access"
                          : "No calendar access"}
                    </p>
                  </div>
                </div>
              </Section>

              <Section title="Account & Calendar" icon={<User className="h-4 w-4" />}>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Google Calendar
                      </p>

                      <p className="mt-2 text-lg font-black text-slate-900">
                        {rules.calendarConnected ? "Connected" : "Not connected"}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {rules.calendarConnected
                          ? `Provider: ${rules.provider} • Permission: ${rules.calendarPermission}`
                          : "Connect Google Calendar to enable availability checks and focus block reservations."}
                      </p>
                    </div>

                    <a
                      href={googleConnectUrl || googleStatus?.authUrl || undefined}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600"
                    >
                      {rules.calendarConnected ? "Reconnect" : "Connect"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

             {googleStatus?.reconnectRequired && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-black text-amber-900">
                    ⚠ Additional Google permission required
                  </p>

                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    Focus20 needs permission to read availability, create focus blocks, and
                    keep your protected time in sync.
                  </p>

                  <a
                    href={googleStatus.authUrl}
                    className="mt-3 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white"
                  >
                    Reconnect Google
                  </a>
                </div>
              )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Calendar Provider
            </p>

            <select
              value={rules.provider}
              onChange={(e) =>
                updateRules({
                  provider: e.target.value as Rules["provider"],
                  calendarConnected: e.target.value !== "local",
                })
              }
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="local">Local</option>
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
            </select>
          </div>

            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Calendar Permission
              </p>

              <select
                value={rules.calendarPermission}
                onChange={(e) =>
                  updateRules({
                    calendarPermission:
                      e.target.value as Rules["calendarPermission"],
                  })
                }
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="write">Read & Write</option>
                <option value="read-only">Read-only</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                How Calendar Permissions Are Used
              </p>

              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <div>
                  <p className="font-bold text-slate-800">Read & Write</p>
                  <p className="mt-1 text-xs leading-5">
                    Focus20 can check availability, create protected focus blocks, update
                    Focus20-created events, and move events you explicitly mark as FLEX.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-800">Read-only</p>
                  <p className="mt-1 text-xs leading-5">
                    Focus20 can check availability and recommend open focus windows, but it
                    cannot create, edit, or move calendar events.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-800">None</p>
                  <p className="mt-1 text-xs leading-5">
                    Focus20 does not access your external calendar and uses only local
                    planning information.
                  </p>
                </div>
              </div>
            </div>
            </Section>

              <Section title="AI Safety Rules" icon={<Shield className="h-4 w-4" />}>
                <div className="grid grid-cols-1 gap-3">
                  <Toggle
                    icon={Shield}
                    label="Protect My 20%"
                    description="Automatically reserve your highest-leverage focus blocks when calendar write access is available."
                    value={rules.protectEnabled}
                    onChange={() =>
                      updateRules({ protectEnabled: !rules.protectEnabled })
                    }
                  />

                  <Toggle
                    icon={PlugZap}
                    label="Flex Shift"
                    description="Allow Focus20 to move unfinished FLEX work. Hard limits stay protected."
                    value={rules.flexShiftEnabled}
                    onChange={() =>
                      updateRules({ flexShiftEnabled: !rules.flexShiftEnabled })
                    }
                  />

                  <Toggle
                    icon={Bell}
                    label="Smart Notifications"
                    description={
                      rules.completedFirstLever
                        ? "Send up to 2 helpful nudges per day: one before focus and one check-in."
                        : "Unlocks after your first completed focus block."
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
                </div>
              </Section>
              <button
                type="button"
                onClick={() => {
                  unlockAudio();

                  setTimeout(() => {
                    playTaskCompletedSound();
                  }, 300);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-white"
              >
                Test Sound
              </button>
              <Section title="Push Notifications" icon={<Bell className="h-4 w-4" />}>
                <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Notification Status
                    </p>

                    <p className="mt-2 text-lg font-black text-slate-900">
                      {rules.notificationsEnabled ? "Enabled" : "Disabled"}
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      Receive reminders before focus sessions and optional completion
                      check-ins.
                    </p>
                  </div>

                  <Bell className="h-8 w-8 text-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <button
                  disabled={isWorking}
                  onClick={() =>
                    runAction(
                      registerPushNotifications,
                      "Push notifications enabled."
                    )
                  }
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Enable
                </button>

                <button
                  disabled={isWorking}
                  onClick={() =>
                    runAction(
                      sendTestPushNotification,
                      "Test notification sent."
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Send Test
                </button>

                <button
                  disabled={isWorking}
                  onClick={() =>
                    runAction(
                      unregisterPushNotifications,
                      "Push notifications disabled."
                    )
                  }
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Disable
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

            <div className="mt-4 space-y-3">
            <button
              onClick={resetOnboarding}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Replay Onboarding
            </button>

            <button
              type="button"
              onClick={onOpenHelp}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open Help & Privacy
            </button>
          </div>
          </Section>
         
        <Section title="Preferences" icon={<PlugZap className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">
                  Buffer Time
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Spacing before and after protected focus blocks.
                </p>
              </div>

              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                {rules.buffersMinutes} min
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={rules.buffersMinutes}
              onChange={(e) =>
                updateRules({ buffersMinutes: Number(e.target.value) })
              }
              className="mt-4 w-full accent-emerald-600"
            />
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">
                  Max Flex Moves
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Daily cap for AI event shifting.
                </p>
              </div>

              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                {rules.maxMovesPerDay}/3
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={rules.maxMovesPerDay}
              onChange={(e) =>
                updateRules({ maxMovesPerDay: Number(e.target.value) })
              }
              className="mt-4 w-full accent-emerald-600"
            />
          </div>
        </div>
      </Section>

        <Section title="Privacy & Data" icon={<Trash2 className="h-4 w-4" />}>
          <div className="space-y-3">
            <button
              disabled={isWorking}
              onClick={() =>
                runAction(apiDisconnectGoogle, "Google Calendar disconnected.")
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Disconnect Google Calendar
            </button>

            <button
              disabled={isWorking}
              onClick={() =>
                runAction(apiResetPatternProfile, "Learned patterns were reset.")
              }
              className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              Reset Learned Patterns
            </button>

            <button
              disabled={isWorking}
              onClick={() =>
                runAction(apiClearUserHistory, "User history cleared.")
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear User History
            </button>
            <button
  onClick={() => {
    throw new Error("Button crash test");
  }}
>
  Crash App
</button>
          </div>
        </Section>
      </div>
    </div>
  );
}