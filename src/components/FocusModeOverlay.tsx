import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Play, Pause, Check } from "lucide-react";
import { WakePlan } from "../types";

interface FocusModeOverlayProps {
  wakePlan: WakePlan;
  onClose: () => void;
  onComplete: () => void;
}

export function FocusModeOverlay({ wakePlan, onClose, onComplete }: FocusModeOverlayProps) {
  const [seconds, setSeconds] = useState(wakePlan.block.durationMinutes * 60);
  const [isRunning, setIsRunning] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isRunning || isComplete) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          setIsComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isComplete]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = ((wakePlan.block.durationMinutes * 60 - seconds) / (wakePlan.block.durationMinutes * 60)) * 100;

  const handleComplete = () => {
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-6"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="text-center max-w-md">
        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-semibold text-white mb-2"
        >
          {isComplete ? "Session Complete!" : "Focus Mode"}
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-slate-400 mb-8"
        >
          {wakePlan.lever.title}
        </motion.p>

        {/* Timer circle */}
        <div className="relative w-64 h-64 mx-auto mb-8">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="128"
              cy="128"
              r="120"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-slate-700"
            />
            <motion.circle
              cx="128"
              cy="128"
              r="120"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              className={isComplete ? "text-emerald-500" : "text-emerald-400"}
              style={{
                strokeDasharray: 2 * Math.PI * 120,
                strokeDashoffset: 2 * Math.PI * 120 * (1 - progress / 100),
              }}
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold text-white font-mono">
              {formatTime(seconds)}
            </span>
            {isComplete && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mt-2"
              >
                <Check className="w-8 h-8 text-emerald-400" />
              </motion.div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {!isComplete && (
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="flex items-center justify-center w-14 h-14 rounded-full bg-white text-slate-900 hover:bg-slate-100 transition-colors"
            >
              {isRunning ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-1" fill="currentColor" />
              )}
            </button>
          )}
          
          {isComplete && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleComplete}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white font-medium rounded-full hover:bg-emerald-600 transition-colors"
            >
              <Check className="w-5 h-5" />
              Complete & Check-in
            </motion.button>
          )}
        </div>

        {/* Plan steps */}
        {!isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-left"
          >
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Your plan</p>
            <ul className="space-y-2">
              {wakePlan.plan.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-400">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}