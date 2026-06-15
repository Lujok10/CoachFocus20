import { useInstallPrompt } from "../hooks/useInstallPrompt";

export function InstallAppPrompt() {
  const { canInstall, installApp } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
      <p className="text-sm font-semibold text-slate-900">
        Install Focus20
      </p>

      <p className="mt-1 text-sm text-slate-500">
        Add Focus20 to your device for a faster, app-like experience.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={installApp}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Install
        </button>
      </div>
    </div>
  );
}