import { Download, Share2, Copy, Flame } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { trackEvent } from "../services/analytics";

type WeeklyReportData = {
  weekStart?: string;
  generatedAt?: string;
  shareText?: string;
  summary?: {
    protectedMinutes?: number;
    completedMinutes?: number;
    completionRate?: number;
    needleMoverWins?: number;
    totalBlocks?: number;
    completedBlocks?: number;
    missedBlocks?: number;
  };
  topLevers?: Array<{
    category: string;
    score: number;
  }>;
  timeLeaks?: Array<{
    title: string;
    category: string;
    reason: string;
  }>;
  trend?: Array<{
    day: string;
    protectedMinutes: number;
    completedMinutes: number;
  }>;
};

type WeeklyReportCardProps = {
  insights: WeeklyReportData;
};

function getSummary(insights: WeeklyReportData) {
  const protectedMinutes = insights.summary?.protectedMinutes ?? 0;
  const completedMinutes = insights.summary?.completedMinutes ?? 0;
  const completionRate = insights.summary?.completionRate ?? 0;
  const wins = insights.summary?.needleMoverWins ?? 0;

  return (
    insights.shareText ??
    `This week I protected ${protectedMinutes} minutes for high-leverage work and completed ${completedMinutes} minutes. Completion rate: ${completionRate}%. Needle-mover wins: ${wins}.`
  );
}

function buildTrend(insights: WeeklyReportData) {
  if (insights.trend?.length) return insights.trend;

  return [
    { day: "Mon", protectedMinutes: 0, completedMinutes: 0 },
    { day: "Tue", protectedMinutes: 0, completedMinutes: 0 },
    { day: "Wed", protectedMinutes: 0, completedMinutes: 0 },
    { day: "Thu", protectedMinutes: 0, completedMinutes: 0 },
    { day: "Fri", protectedMinutes: 0, completedMinutes: 0 },
    { day: "Sat", protectedMinutes: 0, completedMinutes: 0 },
    { day: "Sun", protectedMinutes: 0, completedMinutes: 0 },
  ];
}

export function WeeklyReportCard({ insights }: WeeklyReportCardProps) {
  const summary = insights.summary ?? {};
  const shareText = getSummary(insights);
  const trend = buildTrend(insights);

  const streak =
    (summary.completedBlocks ?? 0) > 0
      ? Math.max(1, Math.min(7, summary.completedBlocks ?? 0))
      : 0;

  const copySummary = async () => {
    await navigator.clipboard.writeText(shareText);
    trackEvent("weekly_report_shared", {
      method: "copy",
    });
  };

  const shareReport = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Focus20 Weekly Report",
        text: shareText,
      });

      trackEvent("weekly_report_shared", {
        method: "native_share",
      });

      return;
    }

    await copySummary();
  };

  const printOrSavePdf = () => {
    trackEvent("weekly_report_shared", {
      method: "pdf_print",
    });

    window.print();
  };

  const downloadSnapshot = async () => {
    const card = document.getElementById("weekly-report-card");

    if (!card) return;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${card.clientWidth}" height="${card.clientHeight}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            ${card.outerHTML}
          </div>
        </foreignObject>
      </svg>
    `;

    const blob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "focus20-weekly-report.svg";
    link.click();

    URL.revokeObjectURL(url);

    trackEvent("weekly_report_shared", {
      method: "image_svg",
    });
  };

  return (
    <div className="space-y-4">
      <div
        id="weekly-report-card"
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Focus20 Weekly Report
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              Protected Focus Progress
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {shareText}
            </p>
          </div>

          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-600">
              <Flame className="h-4 w-4" />
              <span className="text-xl font-bold">{streak}</span>
            </div>
            <p className="mt-1 text-xs text-amber-700">streak</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-2xl font-bold text-emerald-700">
              {summary.protectedMinutes ?? 0}
            </p>
            <p className="text-xs text-emerald-700">Protected minutes</p>
          </div>

          <div className="rounded-2xl bg-blue-50 p-4">
            <p className="text-2xl font-bold text-blue-700">
              {summary.completedMinutes ?? 0}
            </p>
            <p className="text-xs text-blue-700">Completed minutes</p>
          </div>

          <div className="rounded-2xl bg-violet-50 p-4">
            <p className="text-2xl font-bold text-violet-700">
              {summary.completionRate ?? 0}%
            </p>
            <p className="text-xs text-violet-700">Completion rate</p>
          </div>

          <div className="rounded-2xl bg-orange-50 p-4">
            <p className="text-2xl font-bold text-orange-700">
              {summary.needleMoverWins ?? 0}
            </p>
            <p className="text-xs text-orange-700">Needle-mover wins</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-100 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">
            Weekly Trend
          </p>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="protectedMinutes"
                  stroke="#10b981"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="completedMinutes"
                  stroke="#2563eb"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">
              Top Levers
            </p>

            {insights.topLevers?.length ? (
              <div className="space-y-2">
                {insights.topLevers.slice(0, 3).map((lever) => (
                  <div
                    key={lever.category}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                  >
                    <span className="text-sm capitalize text-slate-700">
                      {lever.category}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {lever.score}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Complete a few check-ins to reveal top levers.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">
              Time Leak Alerts
            </p>

            {insights.timeLeaks?.length ? (
              <div className="space-y-2">
                {insights.timeLeaks.slice(0, 3).map((leak) => (
                  <div
                    key={`${leak.title}-${leak.reason}`}
                    className="rounded-xl bg-rose-50 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-rose-800">
                      {leak.title}
                    </p>
                    <p className="text-xs text-rose-600">{leak.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No major time leaks detected this week.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 print:hidden">
        <button
          onClick={copySummary}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          <Copy className="h-4 w-4" />
          Copy Summary
        </button>

        <button
          onClick={shareReport}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>

        <button
          onClick={downloadSnapshot}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          <Download className="h-4 w-4" />
          Image
        </button>

        <button
          onClick={printOrSavePdf}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          <Download className="h-4 w-4" />
          PDF
        </button>
      </div>
    </div>
  );
}