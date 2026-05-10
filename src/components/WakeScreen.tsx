import { motion } from "framer-motion";
import { ChevronUp, Play, Mic, Undo2, CalendarPlus, WifiOff } from "lucide-react";
import { WakePlan } from "../types";

interface WakeScreenProps {
  wakePlan: WakePlan | null;
  isLoading: boolean;
  onSwipeUp: () => void;
  onUndo: () => void;
  onStartFocus: () => void;
  onVoiceCheckIn: () => void;
}

export function WakeScreen({ wakePlan, isLoading, onSwipeUp, onUndo, onStartFocus, onVoiceCheckIn }: WakeScreenProps) {
  const statusLabel = wakePlan?.calendarReconnectRequired
    ? "Reconnect calendar"
    : wakePlan?.readOnlyCalendar
      ? "Read-only calendar"
      : wakePlan?.isReserved
        ? "Block reserved"
        : "Suggested time";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
      <div className="flex-1 flex flex-col items-center justify-center max-w-lg text-center">
        {wakePlan && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-8">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border ${wakePlan.isReserved ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
              {wakePlan.calendarReconnectRequired ? <WifiOff className="w-3.5 h-3.5" /> : <span className="w-2 h-2 bg-current rounded-full" />}
              {statusLabel}
            </span>
          </motion.div>
        )}
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="text-2xl sm:text-3xl font-semibold text-slate-800 leading-relaxed tracking-tight">
          {isLoading ? <span className="text-slate-400">Loading your focus plan...</span> : wakePlan ? wakePlan.sentence : "Connect your calendar to get started."}
        </motion.h1>
        {wakePlan?.readOnlyCalendar && <p className="mt-4 text-sm text-amber-700">Calendar is read-only, so Focus20 suggests instead of silently reserving.</p>}
        {wakePlan?.calendarReconnectRequired && <button className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700"><CalendarPlus className="w-4 h-4" />Reconnect calendar</button>}
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-8">
        <button onClick={onStartFocus} disabled={!wakePlan || wakePlan.status === "cancelled"} className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-40" aria-label="Start focus session"><Play className="w-5 h-5 ml-0.5" /></button>
        <button onClick={onVoiceCheckIn} disabled={!wakePlan} className="flex items-center justify-center w-14 h-14 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40" aria-label="Voice check-in"><Mic className="w-5 h-5" /></button>
        <button onClick={onUndo} disabled={!wakePlan?.isReserved} className="flex items-center justify-center w-14 h-14 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40" aria-label="Undo reservation"><Undo2 className="w-5 h-5" /></button>
      </motion.div>
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onSwipeUp} className="flex flex-col items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer group">
        <span className="text-xs font-medium tracking-wide uppercase">Details</span>
        <motion.div animate={{ y: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}><ChevronUp className="w-5 h-5 group-hover:text-emerald-500" /></motion.div>
      </motion.button>
    </div>
  );
}
