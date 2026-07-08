import type { ProductivityDay } from "../services/productivityMemory";
import { getAchievements } from "../services/achievements";
import confetti from "canvas-confetti";
import { useEffect } from "react";
import { playAchievementSound } from "../services/sounds";

function calculateCurrentStreak(history: ProductivityDay[]) {
  let streak = 0;

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].completedFocusBlocks > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function AchievementsCard({
  history,
}: {
  history: ProductivityDay[];
}) {
  const achievements = getAchievements(history);
  const unlocked = achievements.filter((item) => item.unlocked);
  useEffect(() => {
  const unlockedCount = unlocked.length;

  const previous =
    Number(localStorage.getItem("focus20-unlocked-count")) || 0;

 if (unlockedCount > previous) {
  playAchievementSound();

  confetti({
    particleCount: 150,
    spread: 120,
    origin: {
      y: 0.6,
    },
  });

  localStorage.setItem(
    "focus20-unlocked-count",
    String(unlockedCount)
  );
}

}, [unlocked.length]);
  const streak = calculateCurrentStreak(history);
  useEffect(() => {
        const previous =
            Number(localStorage.getItem("focus20-best-streak")) || 0;

        if (streak > previous && streak >= 3) {
            confetti({
            particleCount: 200,
            spread: 140,
            origin: {
                y: 0.6,
            },
            });

            localStorage.setItem(
            "focus20-best-streak",
            String(streak)
            );
        }
        }, [streak]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-amber-600">
            Achievements
          </p>

          <h2 className="mt-2 text-xl font-black text-slate-900">
            Progress & Streaks
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Track your focus consistency and deep work milestones.
          </p>
        </div>

        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center">
          <p className="text-xs font-bold uppercase text-amber-600">Streak</p>
          <p className="text-2xl font-black text-amber-700">{streak}🔥</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`rounded-2xl p-4 ${
              achievement.unlocked
                ? "bg-emerald-50 text-emerald-800"
                : "bg-slate-50 text-slate-500"
            }`}
          >
            <p className="text-sm font-black">
              {achievement.unlocked ? "🏆 " : "🔒 "}
              {achievement.title}
            </p>

            <p className="mt-1 text-xs leading-5">
              {achievement.description}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs font-semibold text-slate-500">
        {unlocked.length}/{achievements.length} achievements unlocked
      </p>
    </div>
  );
}