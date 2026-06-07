import { useEffect, useState } from "react";
import { apiAdminAnalytics } from "../services/apiClient";

type AdminAnalytics = {
  generatedAt: string;
  totals: Record<string, number>;
  funnel: Array<{
    step: string;
    count: number;
  }>;
  retention: {
    activeUsers7d: number;
    activeUsers14d: number;
    newUsers30d: number;
    sevenDayRetention: number;
    fourteenDayRetention: number;
  };
  completionTrend: Array<{
    day: string;
    scheduled: number;
    completed: number;
    missed: number;
    completionRate: number;
  }>;
  topLeverageCategories: Array<{
    category: string;
    count: number;
    score: number;
  }>;
};

function Bar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className: string;
}) {
  const width = max === 0 ? 0 : Math.min(100, (value / max) * 100);

  return (
    <div className="h-2 rounded-full bg-slate-100">
      <div
        className={`h-2 rounded-full ${className}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function AdminAnalytics() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
  apiAdminAnalytics()
    .then((result) => {
      setData(result as AdminAnalytics);
    })
    .catch((err) => {
      console.error(err);
      setError("Unable to load admin analytics.");
    });
}, []);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading admin analytics...</p>
      </div>
    );
  }

  const maxFunnel = Math.max(1, ...data.funnel.map((item) => item.count));
  const maxTrend = Math.max(
    1,
    ...data.completionTrend.map((item) => item.scheduled)
  );
  const maxCategory = Math.max(
    1,
    ...data.topLeverageCategories.map((item) => item.score)
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 pb-28 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Admin / Dev
          </p>
          <h1 className="text-2xl font-bold text-slate-950">
            Analytics Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {Object.entries(data.totals).map(([key, value]) => (
            <div
              key={key}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="mt-1 text-xs capitalize text-slate-500">
                {key.replaceAll(/([A-Z])/g, " $1")}
              </p>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">
            Funnel Analytics
          </h2>

          <div className="mt-4 space-y-4">
            {data.funnel.map((item) => (
              <div key={item.step}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-700">{item.step}</span>
                  <span className="font-semibold text-slate-900">
                    {item.count}
                  </span>
                </div>
                <Bar
                  value={item.count}
                  max={maxFunnel}
                  className="bg-emerald-500"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-800">
              7-Day Retention
            </p>
            <p className="mt-3 text-3xl font-bold text-emerald-600">
              {data.retention.sevenDayRetention}%
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {data.retention.activeUsers7d} active users
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-800">
              14-Day Retention
            </p>
            <p className="mt-3 text-3xl font-bold text-blue-600">
              {data.retention.fourteenDayRetention}%
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {data.retention.activeUsers14d} active users
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-800">
              New Users 30d
            </p>
            <p className="mt-3 text-3xl font-bold text-violet-600">
              {data.retention.newUsers30d}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">
            Completion Trends
          </h2>

          <div className="mt-4 space-y-4">
            {data.completionTrend.map((item) => (
              <div key={item.day}>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>{item.day}</span>
                  <span>
                    {item.completed}/{item.scheduled} completed ·{" "}
                    {item.completionRate}%
                  </span>
                </div>

                <Bar
                  value={item.scheduled}
                  max={maxTrend}
                  className="bg-slate-300"
                />

                <div className="mt-1">
                  <Bar
                    value={item.completed}
                    max={maxTrend}
                    className="bg-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">
            Top Leverage Categories Globally
          </h2>

          <div className="mt-4 space-y-4">
            {data.topLeverageCategories.length === 0 ? (
              <p className="text-sm text-slate-500">
                No leverage category data yet.
              </p>
            ) : (
              data.topLeverageCategories.map((item) => (
                <div key={item.category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="capitalize text-slate-700">
                      {item.category}
                    </span>
                    <span className="font-semibold text-slate-900">
                      Score {item.score} · {item.count} check-ins
                    </span>
                  </div>

                  <Bar
                    value={Math.max(0, item.score)}
                    max={maxCategory}
                    className="bg-violet-500"
                  />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}