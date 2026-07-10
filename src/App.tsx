import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, SignInButton, useUser } from "@clerk/clerk-react";
import { unlockAudio } from "./services/sounds";
import { Calendar } from "./pages/Calendar";
import { Insights } from "./pages/Insights";
import { Settings } from "./pages/Settings";
import { AdminAnalytics } from "./pages/AdminAnalytics";

import { Navigation } from "./components/Navigation";
import { WakeScreen } from "./components/WakeScreen";
import { DetailsScreen } from "./components/DetailsScreen";
import { FocusModeOverlay } from "./components/FocusModeOverlay";
import { SuccessTargetModal } from "./components/SuccessTargetModal";
import { VoiceCheckIn } from "./components/VoiceCheckIn";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { InstallAppPrompt } from "./components/InstallAppPrompt";
import { ErrorState } from "./components/ErrorState";
import { useLoadingTimeout } from "./components/LoadingTimeout";
import { useWakePlan } from "./hooks/useWakePlan";
import { scheduleFocusReminder } from "./services/notifications";
import {
  getGoogleConnectUrl,
  setClerkTokenProvider,
} from "./services/apiClient";

export type TabType =
  | "home"
  | "calendar"
  | "insights"
  | "settings"
  | "admin-analytics";

export default function App() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [showDetails, setShowDetails] = useState(false);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [showVoiceCheckIn, setShowVoiceCheckIn] = useState(false);
  const [showSuccessTarget, setShowSuccessTarget] = useState(false);
  const [sessionGoal, setSessionGoal] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [googleConnectUrl, setGoogleConnectUrl] = useState("");

  const isAdmin = user?.publicMetadata?.role === "admin";

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

   setClerkTokenProvider(async () => {
    const token = await getToken();

    return token ?? null;
  });

    setAuthReady(true);
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
      if (!authReady) return;

      const completed = localStorage.getItem("focus20_onboarding_completed");

      setShowOnboarding(completed !== "true");

      getGoogleConnectUrl()
        .then(setGoogleConnectUrl)
        .catch(() => setGoogleConnectUrl(""));
    }, [authReady]);


 useEffect(() => {
      const enableAudio = () => {
        unlockAudio();

        document.removeEventListener(
          "pointerdown",
          enableAudio
        );
      };

      document.addEventListener(
        "pointerdown",
        enableAudio,
        { once: true }
      );

      return () => {
        document.removeEventListener(
          "pointerdown",
          enableAudio
        );
      };
    }, []);

  const {
  wakePlan,
  isLoading,
  error,
  undoAction,
  selectAlternative,
  updateStatus,
  refreshPlan,
} = useWakePlan(authReady);

const loadingTimedOut = useLoadingTimeout(isLoading);

  useEffect(() => {
    if (authReady && wakePlan) {
      scheduleFocusReminder(wakePlan);
    }
  }, [authReady, wakePlan]);

  const handleSwipeUp = () => {
    setShowDetails(true);
  };

  const handleBack = () => {
    setShowDetails(false);
  };

  const handleStartFocus = () => {
  setShowSuccessTarget(true);
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

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading authentication...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="text-center">
            <p className="mb-4 text-sm text-slate-500">
              Please sign in to continue.
            </p>

            <SignInButton mode="modal">
              <button className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white">
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>

        <InstallAppPrompt />
      </>
    );
  }

 if (!authReady) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-500">Preparing Focus20...</p>
    </div>
  );
}

if (loadingTimedOut) {
  return (
    <ErrorState
      title="Loading is taking longer than expected"
      message="Check your connection and try again."
      onRetry={() => window.location.reload()}
    />
  );
}

if (error) {
  return (
    <ErrorState
      title="Focus20 couldn't load"
      message={error}
      onRetry={() => window.location.reload()}
    />
  );
}



  return (
    <div className="min-h-screen bg-slate-50">
      <AnimatePresence mode="wait">
        {activeTab === "home" && !showDetails && (
          <motion.div
            key="wake"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              y: -20,
            }}
            transition={{
              duration: 0.3,
            }}
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
            initial={{
              opacity: 0,
              y: 50,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: 50,
            }}
            transition={{
              duration: 0.3,
            }}
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
          {activeTab === "calendar" &&
            (authReady ? (
              <Calendar authReady={authReady} />
            ) : (
              <div className="flex min-h-screen items-center justify-center">
                <p className="text-sm text-slate-500">Preparing calendar...</p>
              </div>
            ))}

          {activeTab === "insights" &&
            (authReady ? (
              <Insights authReady={authReady} />
            ) : (
              <div className="flex min-h-screen items-center justify-center">
                <p className="text-sm text-slate-500">Preparing insights...</p>
              </div>
            ))}

          {activeTab === "settings" && <Settings />}

          {activeTab === "admin-analytics" &&
            (isAdmin ? (
              <AdminAnalytics />
            ) : (
              <div className="flex min-h-screen items-center justify-center px-6 text-center">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">
                    Admin access required
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    This dashboard is only available to admin users.
                  </p>
                </div>
              </div>
            ))}
        </motion.div>
      )}

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {isAdmin && (
        <button
          onClick={() => setActiveTab("admin-analytics")}
          className="fixed bottom-24 right-4 z-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
        >
          Admin
        </button>
      )}

      {showSuccessTarget && (
      <SuccessTargetModal
        goal={sessionGoal}
        onGoalChange={setSessionGoal}
        onCancel={() => setShowSuccessTarget(false)}
        onStart={() => {
          localStorage.setItem(
            "focus20_current_goal",
            sessionGoal
          );

          updateStatus("started");

          setShowSuccessTarget(false);
          setShowFocusMode(true);
        }}
      />
    )}

      <AnimatePresence>
        {showFocusMode && wakePlan && (
          <FocusModeOverlay
          wakePlan={wakePlan}
          onClose={() => setShowFocusMode(false)}
          onComplete={async () => {
            setShowFocusMode(false);
            setShowVoiceCheckIn(true);
            await refreshPlan();
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

      <InstallAppPrompt />

      {showOnboarding && (
        <OnboardingFlow
          onComplete={() => setShowOnboarding(false)}
          onConnectGoogle={() => {
            if (googleConnectUrl) {
              window.location.href = googleConnectUrl;
            }
          }}
        />
      )}
    </div>
  );
}
