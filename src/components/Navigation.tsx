import { motion } from "framer-motion";
import { Home, Calendar, BarChart3, Settings } from "lucide-react";
import { TabType } from "../App";

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: { id: TabType; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Focus", icon: Home },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto px-4 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center gap-1 py-2 px-4 transition-colors"
            >
              <div className="relative">
                {isActive && (
                  <motion.div
                layoutId="navIndicator"
                    className="absolute -inset-2 bg-emerald-50 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon
                  className={`relative w-5 h-5 transition-colors ${
                    isActive ? "text-emerald-600" : "text-slate-400"
                  }`}
                />
              </div>
              <span
                className={`text-xs font-medium transition-colors ${
                  isActive ? "text-emerald-600" : "text-slate-500"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}