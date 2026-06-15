type Props = {
  onUpdate: () => void;
  onDismiss: () => void;
};

export function UpdateAvailablePrompt({ onUpdate, onDismiss }: Props) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
      <p className="text-sm font-semibold text-slate-900">
        Update available
      </p>

      <p className="mt-1 text-sm text-slate-500">
        A new version of Focus20 is ready.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onUpdate}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Update now
        </button>

        <button
          onClick={onDismiss}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
        >
          Later
        </button>
      </div>
    </div>
  );
}