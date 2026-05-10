import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "./pages/Calendar";
import { Insights } from "./pages/Insights";
import { Settings } from "./pages/Settings";
import { Navigation } from "./components/Navigation";
import { WakeScreen } from "./components/WakeScreen";
import { DetailsScreen } from "./components/DetailsScreen";
import { FocusModeOverlay } from "./components/FocusModeOverlay";
import { VoiceCheckIn } from "./components/VoiceCheckIn";
import { useWakePlan } from "./hooks/useWakePlan";
import { scheduleFocusReminder } from "./services/notifications";

export type TabType = "home" | "calendar" | "insights" | "settings";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [showDetails, setShowDetails] = useState(false);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [showVoiceCheckIn, setShowVoiceCheckIn] = useState(false);

  const { wakePlan, isLoading, undoAction, selectAlternative, updateStatus } =
    useWakePlan();

  useEffect(() => {
    if (wakePlan) {
      scheduleFocusReminder(wakePlan);
    }
  }, [wakePlan?.block?.id]);

  const handleSwipeUp = () => {
    setShowDetails(true);
  };

  const handleBack = () => {
    setShowDetails(false);
  };

  const handleStartFocus = () => {
    updateStatus("started");
    setShowFocusMode(true);
  };

  const handleVoiceCheckIn = () => {
    setShowVoiceCheckIn(true);
  };

  const handleUndo = async () => {
    await undoAction();
    setShowDetails(false);
  };

  const handleSelectAlternative = async (index: number) => {
    await selectAlternative(index);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AnimatePresence mode="wait">
        {activeTab === "home" && !showDetails && (
          <motion.div
            key="wake"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen"
          >
            <WakeScreen
              wakePlan={wakePlan}
              isLoading={isLoading}
              onSwipeUp={handleSwipeUp}
              onUndo={handleUndo}
              onStartFocus={handleStartFocus}
              onVoiceCheckIn={handleVoiceCheckIn}
            />
          </motion.div>
        )}

        {activeTab === "home" && showDetails && (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen"
          >
            <DetailsScreen
              wakePlan={wakePlan}
              onBack={handleBack}
              onUndo={handleUndo}
              onSelectAlternative={handleSelectAlternative}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab !== "home" && (
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="min-h-screen pb-24"
        >
          {activeTab === "calendar" && <Calendar />}
          {activeTab === "insights" && <Insights />}
          {activeTab === "settings" && <Settings />}
        </motion.div>
      )}

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      <AnimatePresence>
        {showFocusMode && wakePlan && (
          <FocusModeOverlay
            wakePlan={wakePlan}
            onClose={() => setShowFocusMode(false)}
            onComplete={() => {
              setShowFocusMode(false);
              setShowVoiceCheckIn(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVoiceCheckIn && wakePlan && (
          <VoiceCheckIn
            focusBlockId={wakePlan.block.id}
            onClose={() => setShowVoiceCheckIn(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}