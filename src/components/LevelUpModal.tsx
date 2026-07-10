import { X } from "lucide-react";

type LevelUpModalProps = {
  level: number;
  unlockedFeature?: string;
  onClose: () => void;
};

export function LevelUpModal({
  level,
  unlockedFeature,
  onClose,
}: LevelUpModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="relative w-full max-w-md rounded-3xl border border-violet-200 bg-white p-6 text-center shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close level-up celebration"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-6xl">🚀</div>

        <p className="mt-4 text-xs font-black uppercase tracking-wide text-violet-600">
          Level Up
        </p>

        <h2 className="mt-2 text-3xl font-black text-slate-900">
          You reached Level {level}
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your consistency is paying off. Keep completing high-leverage focus
          sessions to unlock the next level.
        </p>

        {unlockedFeature && (
          <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-600">
              New Unlock
            </p>

            <p className="mt-2 text-lg font-black text-emerald-800">
              {unlockedFeature}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-700"
        >
          Keep Going
        </button>
      </div>
    </div>
  );
}