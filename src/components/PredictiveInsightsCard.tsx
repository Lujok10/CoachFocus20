import type { ProductivityDay } from "../services/productivityMemory";
import { getPredictiveInsights } from "../services/predictiveInsights";

export function PredictiveInsightsCard({
  history,
}: {
  history: ProductivityDay[];
}) {
  const insights = getPredictiveInsights(history);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-blue-600">
        Predictive Insights
      </p>

      <h2 className="mt-2 text-xl font-black text-slate-900">
        What Focus20 sees next
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Forecasts based on your recent focus history.
      </p>

      <div className="mt-5 space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`rounded-2xl p-4 ${
              insight.severity === "positive"
                ? "bg-emerald-50 text-emerald-800"
                : insight.severity === "warning"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-slate-50 text-slate-700"
            }`}
          >
            <p className="text-sm font-black">{insight.title}</p>
            <p className="mt-1 text-xs leading-5">{insight.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}