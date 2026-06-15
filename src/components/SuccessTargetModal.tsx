type Props = {
  goal: string;
  onGoalChange: (value: string) => void;
  onCancel: () => void;
  onStart: () => void;
};

export function SuccessTargetModal({
  goal,
  onGoalChange,
  onCancel,
  onStart,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold">
          Success Target
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          What result should be completed
          before this focus block ends?
        </p>

        <textarea
          value={goal}
          onChange={(e) =>
            onGoalChange(e.target.value)
          }
          placeholder="Example: Finish pricing proposal and send to client"
          className="mt-4 h-32 w-full rounded-xl border border-slate-200 p-3"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2"
          >
            Cancel
          </button>

          <button
            onClick={onStart}
            disabled={!goal.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-white disabled:opacity-50"
          >
            Start Focus Block
          </button>
        </div>
      </div>
    </div>
  );
}