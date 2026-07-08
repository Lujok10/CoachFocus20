import type { ProductivityDay } from "../services/productivityMemory";
import { calculateReadiness } from "../services/readinessScore";

export function ReadinessCard({
  history,
}: {
  history: ProductivityDay[];
}) {
  const result = calculateReadiness(history);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-violet-600">
        Daily Readiness
      </p>

      <h2 className="mt-2 text-xl font-black text-slate-900">
        {result.score}% chance of success
      </h2>

      <p className="mt-3 text-sm text-slate-600">
        {result.summary}
      </p>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-500"
          style={{
            width: `${result.score}%`,
          }}
        />
      </div>
    </div>
  );
}