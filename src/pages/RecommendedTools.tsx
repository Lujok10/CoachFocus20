import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";

type RecommendedToolsProps = {
  onBack: () => void;
};

export function RecommendedTools({ onBack }: RecommendedToolsProps) {
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-slate-200 bg-white p-2"
              aria-label="Back to Settings"
            >
              <ArrowLeft className="h-5 w-5 text-slate-700" />
            </button>

            <div>
              <h1 className="text-xl font-semibold text-slate-800">
                Recommended Tools
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Tools selected to support focus and productivity.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="space-y-4 px-4 py-5">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

            <div>
              <p className="text-sm font-bold text-slate-900">
                Focus20 Recommendations
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                We recommend products and services that may help you stay
                focused, organized, and productive.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
            Coming Soon
          </p>

          <h2 className="mt-2 text-lg font-black text-slate-900">
            Productivity Tools
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Focus20 will feature selected productivity gear, books, workspace
            tools, and services here.
          </p>

          <button
            type="button"
            disabled
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-500"
          >
            View Recommendation
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>

        <p className="px-1 text-xs leading-5 text-slate-500">
          Affiliate disclosure: Focus20 may earn a commission from qualifying
          purchases made through links on this page, at no additional cost to
          you.
        </p>
      </main>
    </div>
  );
}