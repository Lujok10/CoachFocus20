import { useState } from "react";
import { motion } from "framer-motion";
import { X, Mic, Check } from "lucide-react";
import { voiceCheckinRecord } from "../services/deploymentCoach";
import { apiVoiceCheckinRecord } from "../services/apiClient";
import { enqueueOfflineJob } from "../services/offlineQueue";

interface VoiceCheckInProps {
  focusBlockId: string;
  onClose: () => void;
}

type Result = "crushed" | "meh" | "missed" | null;

export function VoiceCheckIn({ focusBlockId, onClose }: VoiceCheckInProps) {
  const [result, setResult] = useState<Result>(null);
  const [needleMover, setNeedleMover] = useState<"yes" | "somewhat" | "no" | null>(null);
  const [completedGoal, setCompletedGoal] = useState<"yes" | "somewhat" | "no" | null>(null);
  const [note, setNote] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const sessionGoal = localStorage.getItem("focus20_current_goal") ?? "";

  const resultOptions = [
    { value: "crushed" as const, label: "Crushed it", emoji: "🔥", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { value: "meh" as const, label: "Meh", emoji: "😐", color: "bg-amber-50 border-amber-200 text-amber-700" },
    { value: "missed" as const, label: "Didn't happen", emoji: "😔", color: "bg-slate-100 border-slate-200 text-slate-700" },
  ];

  const handleRecord = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      setNote("Completed the main deliverable and started on the next phase.");
    }, 1200);
  };

  const handleSubmit = async () => {
    if (!result || !needleMover) return;

    const noteWithGoal = [
      sessionGoal ? `Success target: ${sessionGoal}` : "",
      completedGoal ? `Completed target: ${completedGoal}` : "",
      note ? `Result note: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await apiVoiceCheckinRecord({
        focusBlockId,
        result,
        needleMover,
        noteText: noteWithGoal || undefined,
      });
    } catch {
      enqueueOfflineJob("voice_checkin", {
        focusBlockId,
        result,
        needleMover,
        noteText: noteWithGoal || undefined,
      });

      await voiceCheckinRecord(
        focusBlockId,
        result,
        needleMover,
        noteWithGoal || undefined
      );
    }

    localStorage.removeItem("focus20_current_goal");

    setSubmitted(true);
    setTimeout(onClose, 1000);
  };

  const canSubmit =
    result &&
    needleMover &&
    (!sessionGoal || completedGoal);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 p-6"
    >
      <button
        onClick={onClose}
        className="absolute right-6 top-6 p-2 text-slate-400 transition-colors hover:text-white"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="w-full max-w-md">
        {submitted ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500">
              <Check className="h-10 w-10 text-white" />
            </div>

            <h2 className="mb-2 text-xl font-semibold text-white">
              Thanks for checking in!
            </h2>

            <p className="text-slate-400">
              Saved to Feedback and updated your pattern profile.
            </p>
          </motion.div>
        ) : (
          <>
            <h2 className="mb-8 text-center text-xl font-semibold text-white">
              How did it go?
            </h2>

            {sessionGoal && (
              <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                  Success Target
                </p>

                <p className="mt-2 text-sm text-white">
                  {sessionGoal}
                </p>

                <p className="mt-4 text-sm text-slate-400">
                  Did you complete this target?
                </p>

                <div className="mt-3 flex gap-2">
                  {[
                    { value: "yes" as const, label: "Yes" },
                    { value: "somewhat" as const, label: "Somewhat" },
                    { value: "no" as const, label: "No" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setCompletedGoal(option.value)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        completedGoal === option.value
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8 grid grid-cols-3 gap-3">
              {resultOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setResult(option.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                    result === option.value
                      ? option.color
                      : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <span className="text-2xl">{option.emoji}</span>
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>

            {result && (
              <div className="mb-8">
                <p className="mb-4 text-center text-sm text-slate-400">
                  Was this a needle-mover for your goals?
                </p>

                <div className="flex justify-center gap-3">
                  {[
                    { value: "yes" as const, label: "Yes" },
                    { value: "somewhat" as const, label: "Somewhat" },
                    { value: "no" as const, label: "No" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setNeedleMover(option.value)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        needleMover === option.value
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {needleMover && (
              <div className="mb-8">
                <p className="mb-4 text-center text-sm text-slate-400">
                  Add a quick note (optional)
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRecord}
                    disabled={isRecording}
                    className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                      isRecording
                        ? "animate-pulse bg-rose-500"
                        : "bg-slate-700 hover:bg-slate-600"
                    }`}
                  >
                    <Mic className="h-5 w-5 text-white" />
                  </button>

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Type or record a note..."
                    className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-slate-600 focus:outline-none"
                    rows={2}
                  />
                </div>
              </div>
            )}

            {canSubmit && (
              <button
                onClick={handleSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-medium text-white transition-colors hover:bg-emerald-600"
              >
                <Check className="h-5 w-5" />
                Submit Check-in
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}