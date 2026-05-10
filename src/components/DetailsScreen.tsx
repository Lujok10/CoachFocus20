import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Undo2, Lightbulb, Clock, AlertTriangle, Sparkles, Check } from "lucide-react";
import { WakePlan } from "../types";

interface DetailsScreenProps {
  wakePlan: WakePlan | null;
  onBack: () => void;
  onUndo: () => void;
  onSelectAlternative: (index: number) => void;
}

export function DetailsScreen({ wakePlan, onBack, onUndo, onSelectAlternative }: DetailsScreenProps) {
  const [selectedAlt, setSelectedAlt] = useState<number | null>(null);
  const [undoClicked, setUndoClicked] = useState(false);
  const [timeLeakFixing, setTimeLeakFixing] = useState(false);

  if (!wakePlan) return null;

  const categoryColors: Record<string, string> = {
    income: "bg-emerald-50 text-emerald-700 border-emerald-200",
    health: "bg-rose-50 text-rose-700 border-rose-200",
    family: "bg-violet-50 text-violet-700 border-violet-200",
    admin: "bg-slate-100 text-slate-700 border-slate-200",
    learning: "bg-blue-50 text-blue-700 border-blue-200",
    creative: "bg-amber-50 text-amber-700 border-amber-200",
  };

  const handleUndo = () => {
    setUndoClicked(true);
    setTimeout(() => {
      onUndo();
      setUndoClicked(false);
    }, 200);
  };

  const handleSelectAlternative = (index: number) => {
    setSelectedAlt(index);
    setTimeout(() => {
      onSelectAlternative(index);
      setSelectedAlt(null);
    }, 300);
  };

  const handleFixTimeLeak = () => {
    setTimeLeakFixing(true);
    setTimeout(() => {
      setTimeLeakFixing(false);
      // In a real app, this would trigger the fix
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 bg-white border-b border-slate-200 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <button
            onClick={handleUndo}
            disabled={!wakePlan.isReserved}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              undoClicked
                ? "bg-rose-100 text-rose-700"
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {undoClicked ? (
              <>
                <Check className="w-4 h-4" />
                Undone
              </>
            ) : (
              <>
                <Undo2 className="w-4 h-4" />
                Undo
              </>
            )}
          </button>
        </div>
      </header>

      <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
        {/* Why this matters */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200 p-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 mb-1">Why this matters</h2>
              <p className="text-slate-600 text-sm leading-relaxed">{wakePlan.why}</p>
            </div>
          </div>
        </motion.section>

        {/* Focus plan */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 p-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Your focus plan</h2>
              <ul className="space-y-2">
                {wakePlan.plan.map((step, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
                      {index + 1}
                    </span>
                    <span className="text-sm text-slate-600">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        {/* Alternatives */}
        {wakePlan.alternatives.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-slate-800 mb-3">Alternatives</h2>
                <div className="space-y-2">
                  {wakePlan.alternatives.map((alt, index) => (
                    <button
                      key={index}
                      onClick={() => handleSelectAlternative(index)}
                      disabled={selectedAlt !== null}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                        selectedAlt === index
                          ? "bg-emerald-50 border-emerald-300"
                          : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {selectedAlt === index && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
                          >
                            <Check className="w-3 h-3 text-white" />
                          </motion.div>
                        )}
                        <div>
                          <p className={`text-sm font-medium ${
                            selectedAlt === index ? "text-emerald-800" : "text-slate-700"
                          }`}>
                            {alt.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{alt.time}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${categoryColors[alt.category]}`}>
                        {alt.category}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Time leak alert */}
        {wakePlan.timeLeak && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-amber-50 rounded-2xl border border-amber-200 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-amber-800 mb-1">Time leak detected</h2>
                <p className="text-sm text-amber-700 mb-3">
                  {wakePlan.timeLeak.title} ({wakePlan.timeLeak.minutes}min)
                </p>
                <button 
                  onClick={handleFixTimeLeak}
                  disabled={timeLeakFixing}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    timeLeakFixing
                      ? "bg-amber-200 text-amber-800"
                      : "bg-amber-600 text-white hover:bg-amber-700"
                  }`}
                >
                  {timeLeakFixing ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Clock className="w-4 h-4" />
                      </motion.div>
                      Fixing...
                    </>
                  ) : (
                    wakePlan.timeLeak!.fixAction
                  )}
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}