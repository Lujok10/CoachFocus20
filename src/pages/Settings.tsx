import { useEffect, useState } from "react";
import type React from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Shield,
  Trash2,
  ChevronRight,
  Moon,
  Sun,
  User,
  Calendar,
  Database,
  PlugZap,
  ExternalLink,
} from "lucide-react";

import {
  getActionsLog,
  getUserRules,
  resetLocalData,
  saveUserRules,
} from "../services/deploymentCoach";

import { getAnalytics } from "../services/analytics";

import {
  apiGetUserRules,
  apiSaveUserRules,
  getGoogleConnectUrl,
  apiDisconnectGoogle,
  apiResetPatternProfile,
  apiClearUserHistory,
} from "../services/apiClient";

import type { UserRules } from "../types";

export function Settings() {
  const [rules, setRules] = useState(getUserRules());
  const [backendOnline, setBackendOnline] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [actionsCount, setActionsCount] = useState(getActionsLog().length);
  const [analyticsCount, setAnalyticsCount] = useState(getAnalytics().length);
  const [googleConnectUrl, setGoogleConnectUrl] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  

  useEffect(() => {
    apiGetUserRules()
      .then((remoteRules) => {
        setRules(remoteRules);
        setBackendOnline(true);
      })
      .catch(() => setBackendOnline(false));
  }, []);

  useEffect(() => {
  apiGetUserRules()
    .then((remoteRules) => {
      setRules(remoteRules);
      setBackendOnline(true);
    })
    .catch(() => setBackendOnline(false));

  getGoogleConnectUrl()
    .then(setGoogleConnectUrl)
    .catch(() => setGoogleConnectUrl(""));
}, []);

const loadRules = async () => {
  try {
    const data = await apiGetUserRules();
    setRules(data);
  } catch (error) {
    console.error("Failed to load rules", error);
  }
};

useEffect(() => {
  loadRules();
}, []);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get("calendar") === "connected") {
    loadRules();

    window.history.replaceState(
      {},
      "",
      window.location.pathname
    );
  }
}, []);

  const updateRules = async (next: Partial<UserRules>) => {
    const localSaved = saveUserRules(next);
    setRules(localSaved);

    try {
      const remoteSaved = await apiSaveUserRules(next);
      setRules(remoteSaved);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  };

  const clearData = () => {
    resetLocalData();
    setRules(getUserRules());
    setActionsCount(0);
    setAnalyticsCount(0);
  };

  async function handleDisconnectGoogle() {
    const confirmed = window.confirm(
      "Disconnect Google Calendar? Focus20 will stop writing calendar events."
    );

    if (!confirmed) return;

    setIsWorking(true);
    setStatusMessage("");

    try {
      await apiDisconnectGoogle();

      const localSaved = saveUserRules({
        provider: "local",
        calendarConnected: false,
        calendarPermission: "none",
      });

      setRules(localSaved);
      setStatusMessage("Google Calendar disconnected.");
      setBackendOnline(true);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to disconnect Google."
      );
      setBackendOnline(false);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleResetPatternProfile() {
    const confirmed = window.confirm(
      "Reset learned patterns? Focus20 will forget learned windows and lever rankings."
    );

    if (!confirmed) return;

    setIsWorking(true);
    setStatusMessage("");

    try {
      await apiResetPatternProfile();
      setStatusMessage("Pattern profile reset.");
      setBackendOnline(true);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to reset profile."
      );
      setBackendOnline(false);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleClearHistory() {
    const confirmed = window.confirm(
      "Clear history? This deletes focus blocks, feedback, analytics, tasks, and queued writes. Settings are preserved."
    );

    if (!confirmed) return;

    setIsWorking(true);
    setStatusMessage("");

    try {
      await apiClearUserHistory();
      resetLocalData();
      setActionsCount(0);
      setAnalyticsCount(0);
      setStatusMessage("History cleared.");
      setBackendOnline(true);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to clear history."
      );
      setBackendOnline(false);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="px-4 py-4">
          <h1 className="text-xl font-semibold text-slate-800">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Controls for calendar, AI actions, privacy, and backend orchestration
          </p>
        </div>
      </header>

      <div className="space-y-6 px-4 py-4">
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
            description="Demo user until production auth is added"
          />

          <Row
            icon={Calendar}
            label="Google Calendar OAuth"
            description={
              rules.calendarConnected && rules.provider === "google"
                ? "Connected for real write-back"
                : "Connect to enable free/busy + event creation"
            }
          >
            <a
              
              href={googleConnectUrl || "#"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600"
            >
              Connect <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Row>

          <Row
            icon={Calendar}
            label="Connected Calendars"
            description={rules.calendarConnected ? `${rules.provider} connected` : "Not connected"}
          >
            <select
              value={rules.provider}
              onChange={(e) =>
                updateRules({
                  provider: e.target.value as typeof rules.provider,
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
            description="Controls reserve vs suggestion behavior"
          >
            <select
              value={rules.calendarPermission}
              onChange={(e) =>
                updateRules({
                  calendarPermission:
                    e.target.value as typeof rules.calendarPermission,
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

        <Section title="Preferences">
          <Toggle
            icon={darkMode ? Moon : Sun}
            label="Dark Mode"
            description={darkMode ? "On" : "Off"}
            value={darkMode}
            onChange={() => setDarkMode(!darkMode)}
          />
        </Section>

        <Section title="Audit, Analytics & Privacy">
          <Row
            icon={Database}
            label="Actions Log"
            description={`${actionsCount} local audit entries; backend stores production actions in Postgres`}
          >
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </Row>

          <Row
            icon={Database}
            label="Analytics Events"
            description={`${analyticsCount} local events; backend records API analytics too`}
          >
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </Row>

          <button
            onClick={clearData}
            className="flex w-full items-center justify-between p-4 text-left hover:bg-rose-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>

              <div>
                <p className="text-sm font-medium text-rose-600">
                  Delete Local Demo Data
                </p>
                <p className="text-xs text-slate-500">
                  Clears browser plans, feedback, actions log, and analytics
                </p>
              </div>
            </div>
          </button>
        </Section>

        <Section title="Data Controls">
          <div className="p-4">
            <p className="text-xs text-slate-500">
              Manage calendar access, learned patterns, and backend usage history.
            </p>

            {statusMessage && (
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {statusMessage}
              </p>
            )}

            <div className="mt-4 space-y-3">
              <button
                onClick={handleDisconnectGoogle}
                disabled={isWorking}
                className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-700 disabled:opacity-50"
              >
                Disconnect Google Calendar
              </button>

              <button
                onClick={handleResetPatternProfile}
                disabled={isWorking}
                className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-semibold text-blue-700 disabled:opacity-50"
              >
                Reset Learned Pattern Profile
              </button>

              <button
                onClick={handleClearHistory}
                disabled={isWorking}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-700 disabled:opacity-50"
              >
                Clear Focus20 History
              </button>
            </div>
          </div>
        </Section>

        <div className="pt-4 text-center">
          <p className="text-xs text-slate-400">Focus 20 v1.3.0</p>
          <p className="mt-1 text-xs text-slate-400">
            Google Calendar backend + data controls enabled
          </p>
        </div>
      </div>
    </div>
  );
}

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
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>

      <div className="divide-y divide-slate-100">{children}</div>
    </motion.section>
  );
}

function Row({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>

      {children}
    </div>
  );
}

function Toggle({
  icon: Icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-50"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>

      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}