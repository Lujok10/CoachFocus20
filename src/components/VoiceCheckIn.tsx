import { useState } from "react";
import { motion } from "framer-motion";
import { X, Mic, Check } from "lucide-react";
import { voiceCheckinRecord } from "../services/deploymentCoach";
import { apiVoiceCheckinRecord } from "../services/apiClient";

interface VoiceCheckInProps {
  focusBlockId: string;
  onClose: () => void;
}

type Result = "crushed" | "meh" | "missed" | null;

export function VoiceCheckIn({ focusBlockId, onClose }: VoiceCheckInProps) {
  const [result, setResult] = useState<Result>(null);
  const [needleMover, setNeedleMover] = useState<"yes" | "somewhat" | "no" | null>(null);
  const [note, setNote] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    try {
      await apiVoiceCheckinRecord({ focusBlockId, result, needleMover, noteText: note || undefined });
    } catch (error) {
      console.warn("Focus20 API check-in unavailable. Falling back to local record.", error);
      await voiceCheckinRecord(focusBlockId, result, needleMover, note || undefined);
    }
    setSubmitted(true);
    setTimeout(onClose, 1000);
  };

  const canSubmit = result && needleMover;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-6">
      <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
      <div className="w-full max-w-md">
        {submitted ? (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4"><Check className="w-10 h-10 text-white" /></div>
            <h2 className="text-xl font-semibold text-white mb-2">Thanks for checking in!</h2>
            <p className="text-slate-400">Saved to Feedback and updated your pattern profile.</p>
          </motion.div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-white text-center mb-8">How did it go?</h2>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {resultOptions.map((option) => (
                <button key={option.value} onClick={() => setResult(option.value)} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${result === option.value ? option.color : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"}`}>
                  <span className="text-2xl">{option.emoji}</span>
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
            {result && (
              <div className="mb-8">
                <p className="text-sm text-slate-400 text-center mb-4">Was this a needle-mover for your goals?</p>
                <div className="flex justify-center gap-3">
                  {[
                    { value: "yes" as const, label: "Yes" },
                    { value: "somewhat" as const, label: "Somewhat" },
                    { value: "no" as const, label: "No" },
                  ].map((option) => (
                    <button key={option.value} onClick={() => setNeedleMover(option.value)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${needleMover === option.value ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{option.label}</button>
                  ))}
                </div>
              </div>
            )}
            {needleMover && (
              <div className="mb-8">
                <p className="text-sm text-slate-400 text-center mb-4">Add a quick note (optional)</p>
                <div className="flex items-center gap-3">
                  <button onClick={handleRecord} disabled={isRecording} className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${isRecording ? "bg-rose-500 animate-pulse" : "bg-slate-700 hover:bg-slate-600"}`}><Mic className="w-5 h-5 text-white" /></button>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Type or record a note..." className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 resize-none" rows={2} />
                </div>
              </div>
            )}
            {canSubmit && <button onClick={handleSubmit} className="w-full py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"><Check className="w-5 h-5" />Submit Check-in</button>}
          </>
        )}
      </div>
    </motion.div>
  );
}
