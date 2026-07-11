import {
  Calendar,
  HelpCircle,
  Mic,
  RefreshCcw,
  Shield,
  Sparkles,
} from "lucide-react";

type HelpProps = {
  onReplayOnboarding: () => void;
  onBack: () => void;
};

export function Help({
  onReplayOnboarding,
  onBack,
}: HelpProps) {
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
          <div className="px-4 py-5">
            <button
              type="button"
              onClick={onBack}
              className="mb-4 text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              ← Back to Settings
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50">
                <HelpCircle className="h-5 w-5 text-indigo-600" />
              </div>

              <div>
                <h1 className="text-xl font-black text-slate-900">
                  Help & Onboarding
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Learn how Focus20 uses your calendar, voice check-ins, and focus data.
                </p>
              </div>
            </div>
          </div>
        </header>

      <div className="space-y-4 px-4 py-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Calendar className="mt-1 h-5 w-5 text-emerald-600" />

            <div>
              <h2 className="font-black text-slate-900">
                Calendar permissions
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Read-only access lets Focus20 check availability and suggest
                focus windows. Read & Write access lets Focus20 reserve focus
                blocks and update events you explicitly allow it to manage.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Mic className="mt-1 h-5 w-5 text-blue-600" />

            <div>
              <h2 className="font-black text-slate-900">
                Voice check-in privacy
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Focus20 uses microphone access only while you actively record a
                check-in. It does not continuously listen in the background.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Shield className="mt-1 h-5 w-5 text-violet-600" />

            <div>
              <h2 className="font-black text-slate-900">
                Your data
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Productivity history is used to calculate streaks, achievements,
                readiness, and predictive insights. You can clear your history
                from Settings.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="flex items-start gap-3">
    <Sparkles className="mt-1 h-5 w-5 text-amber-600" />

    <div>
      <h2 className="font-black text-slate-900">
        How Focus20 works
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Focus20 identifies high-leverage work, recommends protected time,
        tracks completion, and learns which work patterns are most effective
        for you.
      </p>
    </div>
  </div>
</section>

<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
  <h2 className="font-black text-slate-900">
    Getting Started
  </h2>

  <ul className="mt-3 space-y-2 text-sm text-slate-600">
    <li>✓ Connect your calendar</li>
    <li>✓ Create your first focus block</li>
    <li>✓ Complete one voice check-in</li>
    <li>✓ Earn your first achievement</li>
  </ul>
</section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-900">
            Need help?
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            If something is not working, try replaying onboarding, reconnecting your
            calendar, or checking your settings.
          </p>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-900">
            Contact Support
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Need assistance with Focus20? Reach out to us and we'll help you get back on track.
          </p>

          <div className="mt-4 space-y-3">
            <a
              href="mailto:support@focus20.app"
              className="flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              Email Support
            </a>

            <button
              type="button"
              onClick={() => {
                const info =
                  `Focus20 v1.3.0\n` +
                  `User Agent: ${navigator.userAgent}\n` +
                  `Platform: ${navigator.platform}\n` +
                  `Language: ${navigator.language}\n` +
                  `Online: ${navigator.onLine}\n` +
                  `Time: ${new Date().toISOString()}`;
                navigator.clipboard.writeText(info);
                  window.alert(
                    "Diagnostics copied. You can paste them into your support email."
                  );
              }}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Copy Diagnostics
            </button>

           <a
            href="mailto:focus20.ai.coach@gmail.com"
            className="block text-center text-xs text-slate-400 hover:text-slate-600"
          >
            focus20.ai.coach@gmail.com
          </a>
          </div>
        </section>

        <button
          type="button"
          onClick={onReplayOnboarding}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-4 text-sm font-black text-white hover:bg-indigo-700"
        >
          <RefreshCcw className="h-4 w-4" />
          Replay Onboarding
        </button>

        <button
          type="button"
          onClick={() => {
            const confirmed = window.confirm(
              "This will clear Focus20 data stored on this device. Continue?"
            );

            if (!confirmed) return;

            localStorage.clear();
            window.location.reload();
          }}
          className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-bold text-red-700 hover:bg-red-100"
        >
          Reset Focus20 Data
        </button>

        <p className="pt-2 text-center text-xs text-slate-400">
          Focus20 v1.3.0
        </p>
      </div>
    </div>
  );
}